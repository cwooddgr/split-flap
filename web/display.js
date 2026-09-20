import { db, doc, onSnapshot, ensureSignedIn, backoffMs } from './firebase-init.js';
import { SplitFlapDisplay } from './splitflap.js';

// Small-screen handling: show a simple message instead of the display UI
const SMALL_SCREEN_MAX_WIDTH = 768; // adjust threshold if you like
const isSmallScreen = window.innerWidth <= SMALL_SCREEN_MAX_WIDTH;

if (isSmallScreen) {
    const displayContainer = document.querySelector('.display-container');
    const audioPromptEl = document.getElementById('audioPrompt');
    const qrContainer = document.getElementById('qr-container');
    const smallScreenMessageEl = document.getElementById('smallScreenMessage');

    if (displayContainer) displayContainer.style.display = 'none';
    if (audioPromptEl) audioPromptEl.style.display = 'none';
    if (qrContainer) qrContainer.style.display = 'none';
    if (smallScreenMessageEl) smallScreenMessageEl.classList.remove('hidden');
}

function generateRoomId(length = 6) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let id = '';
    for (let i = 0; i < length; i++) {
        id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
}

// Always generate a fresh room id on each page load so a refresh
// effectively "disconnects" old remotes and starts a new session.
const roomId = generateRoomId(6 + Math.floor(Math.random() * 3)); // 6–8 chars

// Initialize split-flap display (cols, rows)
// Using 21x6 to make cells larger and use more vertical space
const display = new SplitFlapDisplay('displayBoard', 21, 6);

// Default message placeholder for the display on load.
// Currently empty so the board starts blank, but kept for easy future tweaks.
const DEFAULT_WELCOME_TEXT = '';

// Status line. It appears only after trouble has lasted a few seconds, so a
// normal page load or a brief blip never shows it.
const STATUS_DELAY_MS = 5000;
const statusEl = document.getElementById('status');
let statusTimer = null;

function setTrouble(message) {
    if (!statusEl) return;
    if (!message) {
        clearTimeout(statusTimer);
        statusTimer = null;
        statusEl.classList.add('hidden');
        return;
    }
    statusEl.textContent = message;
    if (statusTimer || !statusEl.classList.contains('hidden')) return;
    statusTimer = setTimeout(() => {
        statusTimer = null;
        statusEl.classList.remove('hidden');
    }, STATUS_DELAY_MS);
}

// QR code pointing to control.html for this room. It needs only the room id,
// so it goes up before anything touches the network.
const qrElement = document.getElementById('qrcode');
const qrContainer = document.getElementById('qr-container');
if (qrElement && window.QRCode) {
    const controlUrl = new URL('control.html', window.location.href);
    controlUrl.searchParams.set('room', roomId);
    // Also store room in the hash as a fallback, in case query params are stripped
    controlUrl.hash = 'room=' + roomId;

    // Drawn large; the stylesheet scales it to the screen.
    // eslint-disable-next-line no-new
    new QRCode(qrElement, {
        text: controlUrl.toString(),
        width: 512,
        height: 512,
        colorDark: '#000000',
        colorLight: '#ffffff',
        correctLevel: window.QRCode.CorrectLevel.M,
    });
}

// The sound prompt is up only while the browser is holding audio back for a
// tap, click, or key press. FlipSound resumes on that gesture by itself.
const audioPromptEl = document.getElementById('audioPrompt');
function showAudioPrompt(needsGesture) {
    if (audioPromptEl && !isSmallScreen) {
        audioPromptEl.classList.toggle('hidden', !needsGesture);
    }
}
display.sound.onStateChange = showAudioPrompt;
showAudioPrompt(display.sound.needsGesture);

// A click that enables sound does only that. Any other click toggles the QR code.
document.addEventListener('click', () => {
    if (audioPromptEl && !audioPromptEl.classList.contains('hidden')) return;
    if (qrContainer && !isSmallScreen) qrContainer.classList.toggle('hidden');
});

// Once a remote has sent something, the QR code has done its job. A click
// brings it back for the next phone.
let hidQrForFirstMessage = false;
function hideQrAfterFirstMessage() {
    if (hidQrForFirstMessage) return;
    hidQrForFirstMessage = true;
    if (qrContainer) qrContainer.classList.add('hidden');
}

// Keep the screen awake. The lock is released whenever the tab is hidden, so
// ask again each time it comes back. Not every browser has it.
async function keepAwake() {
    if (!('wakeLock' in navigator) || document.hidden) return;
    try {
        await navigator.wakeLock.request('screen');
    } catch (error) {
        console.warn('No wake lock, the screen may sleep', error);
    }
}
document.addEventListener('visibilitychange', keepAwake);
keepAwake();

// Full-screen button, where the browser can do it (not on an iPhone).
const fullscreenBtn = document.getElementById('fullscreenBtn');
if (fullscreenBtn && document.documentElement.requestFullscreen && !isSmallScreen) {
    fullscreenBtn.classList.remove('hidden');
    fullscreenBtn.addEventListener('click', (event) => {
        event.stopPropagation(); // not a QR toggle
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            document.documentElement.requestFullscreen().catch(() => {});
        }
    });
    document.addEventListener('fullscreenchange', () => {
        fullscreenBtn.textContent = document.fullscreenElement ? 'Exit full screen' : 'Full screen';
    });
}

// Hide the pointer and the button once the mouse has been still for a while.
const POINTER_IDLE_MS = 3000;
let pointerTimer = null;
function pointerMoved() {
    document.body.classList.remove('pointer-idle');
    clearTimeout(pointerTimer);
    pointerTimer = setTimeout(() => document.body.classList.add('pointer-idle'), POINTER_IDLE_MS);
}
document.addEventListener('pointermove', pointerMoved);
document.addEventListener('pointerdown', pointerMoved); // a touch screen has no hover
pointerMoved();

// One listener for the life of the page. The SDK reconnects it and refreshes
// the auth token without help. Snapshot metadata is the only connection signal:
// fromCache turns true when the SDK loses the server and false when it is back,
// so the status always clears. (A window 'offline' handler would not: after a
// short blip the SDK sends no new snapshot, and the message would stay up.) A listener error (rules, a revoked user) ends
// it, so that case resubscribes with capped backoff.
let listenerFailures = 0;

function listen() {
    onSnapshot(
        doc(db, 'rooms', roomId),
        { includeMetadataChanges: true },
        (snapshot) => {
            if (snapshot.metadata.fromCache) {
                setTrouble('Reconnecting…');
            } else {
                listenerFailures = 0;
                setTrouble(null);
            }
            // The room document doesn't exist until a remote first writes to it.
            if (!snapshot.exists()) return;
            const data = snapshot.data();
            if (typeof data.text === 'string') {
                display.setText(data.text);
                hideQrAfterFirstMessage();
            }
        },
        (error) => {
            console.error('Room listener failed, will resubscribe', error);
            setTrouble('Reconnecting…');
            setTimeout(listen, backoffMs(listenerFailures++));
        }
    );
}

// Show a default welcome message until a remote sends text
display.setText(DEFAULT_WELCOME_TEXT);

// Anonymous auth first, so Firestore rules allow the read.
await ensureSignedIn(() => setTrouble('Reconnecting…'));
listen();
