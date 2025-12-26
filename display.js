import { db, doc, onSnapshot, ensureSignedIn } from './firebase-init.js';
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

// Subtle overlay to prompt the user to enable sound with a single tap
const audioPromptEl = document.getElementById('audioPrompt');
if (audioPromptEl) {
    const hidePrompt = () => {
        audioPromptEl.classList.add('hidden');
    };

    const handleFirstInteraction = () => {
        // initAudio in SplitFlapDisplay listens for the same first interaction
        // and will resume the AudioContext. Here we just hide the UI.
        hidePrompt();
        document.removeEventListener('click', handleFirstInteraction);
        document.removeEventListener('touchstart', handleFirstInteraction);
    };

    document.addEventListener('click', handleFirstInteraction, { once: true });
    document.addEventListener('touchstart', handleFirstInteraction, {
        once: true,
        passive: true,
    });
}

// Generate QR code pointing to control.html for this room and listen for updates
(async () => {
    // Wait for anonymous auth so Firestore rules allow access
    await ensureSignedIn();

    // QR code
    const qrElement = document.getElementById('qrcode');
    const qrContainer = document.getElementById('qr-container');
    if (qrElement && window.QRCode) {
        const controlUrl = new URL('control.html', window.location.href);
        controlUrl.searchParams.set('room', roomId);
        // Also store room in the hash as a fallback, in case query params are stripped
        controlUrl.hash = 'room=' + roomId;
        const controlUrlString = controlUrl.toString();

        // eslint-disable-next-line no-new
        new QRCode(qrElement, {
            text: controlUrlString,
            width: 112,
            height: 112,
            colorDark: '#000000',
            colorLight: '#ffffff',
            correctLevel: window.QRCode.CorrectLevel.M,
        });

        // Allow user to hide the QR overlay with a single tap/click
        if (qrContainer) {
            qrContainer.addEventListener('click', () => {
                qrContainer.style.display = 'none';
            });
        }
    }

    // Listen to Firestore document for this room with automatic reconnection
    const roomRef = doc(db, 'rooms', roomId);
    let unsubscribe = null;

    function subscribeToRoom() {
        // Clean up any existing subscription
        if (unsubscribe) {
            unsubscribe();
        }

        unsubscribe = onSnapshot(
            roomRef,
            (snapshot) => {
                if (!snapshot.exists()) {
                    return;
                }
                const data = snapshot.data();
                if (typeof data.text === 'string') {
                    display.setText(data.text);
                }
            },
            async (error) => {
                console.error('Error listening to room document', error);
                // Wait a moment then try to reconnect
                await new Promise((r) => setTimeout(r, 2000));
                console.log('Attempting to reconnect to Firestore...');
                await ensureSignedIn();
                subscribeToRoom();
            }
        );
    }

    subscribeToRoom();

    // Resubscribe when the page becomes visible again (e.g., after sleep/tab switch)
    document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState === 'visible') {
            console.log('Page visible, refreshing Firestore connection...');
            await ensureSignedIn();
            subscribeToRoom();
        }
    });

    // Show a default welcome message until a remote sends text
    display.setText(DEFAULT_WELCOME_TEXT);
})();

