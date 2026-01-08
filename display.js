import { db, doc, onSnapshot, ensureSignedIn, forceTokenRefresh } from './firebase-init.js';
import { SplitFlapDisplay } from './splitflap.js';

// Debug logging helper with timestamps
function debugLog(message, data = null) {
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
    if (data !== null) {
        console.log(`[${timestamp}] ${message}`, data);
    } else {
        console.log(`[${timestamp}] ${message}`);
    }
}

// Connection health tracking
let lastServerSnapshotTime = null;
let lastReconnectAttempt = null; // Prevent rapid reconnect attempts
let retryDelay = 2000; // Start at 2 seconds, will increase exponentially
const MAX_RETRY_DELAY = 30000; // Cap at 30 seconds
const HEARTBEAT_INTERVAL = 5 * 60 * 1000; // 5 minutes
const STALE_THRESHOLD = 10 * 60 * 1000; // 10 minutes - force reconnect if no server snapshot
const RECONNECT_COOLDOWN = 10 * 60 * 1000; // 10 minutes - don't retry if we just tried

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
    let unsubscribe = null;

    function subscribeToRoom() {
        // Clean up any existing subscription
        if (unsubscribe) {
            unsubscribe();
        }

        // Create fresh document reference (important after Firestore reset)
        const roomRef = doc(db, 'rooms', roomId);
        debugLog(`Subscribing to room: ${roomId}`);

        unsubscribe = onSnapshot(
            roomRef,
            (snapshot) => {
                const { fromCache, hasPendingWrites } = snapshot.metadata;
                const exists = snapshot.exists();
                const data = exists ? snapshot.data() : null;
                const text = data && data.text ? data.text : '';
                const textPreview = text ? text.substring(0, 30).replace(/\n/g, '\\n') : '(none)';

                debugLog(`Snapshot received: exists=${exists}, fromCache=${fromCache}, hasPendingWrites=${hasPendingWrites}, text="${textPreview}${text.length > 30 ? '...' : ''}"`);

                // Track server snapshots (not from cache)
                if (!fromCache) {
                    lastServerSnapshotTime = Date.now();
                    retryDelay = 2000; // Reset retry delay on successful server connection
                    debugLog('Server snapshot confirmed - connection healthy');
                }

                if (!exists) {
                    return;
                }
                if (typeof data.text === 'string') {
                    display.setText(data.text);
                }
            },
            async (error) => {
                debugLog('Error listening to room document:', error);

                // Exponential backoff
                debugLog(`Attempting reconnect in ${retryDelay}ms (attempt after error)`);
                await new Promise((r) => setTimeout(r, retryDelay));

                // Increase delay for next time, capped at max
                retryDelay = Math.min(retryDelay * 2, MAX_RETRY_DELAY);

                debugLog('Reconnecting to Firestore...');
                await ensureSignedIn();
                subscribeToRoom();
            }
        );
    }

    subscribeToRoom();

    // Heartbeat: periodically check connection health and force reconnect if stale
    setInterval(async () => {
        const now = Date.now();
        const timeSinceLastServer = lastServerSnapshotTime ? now - lastServerSnapshotTime : null;
        const timeSinceLastReconnect = lastReconnectAttempt ? now - lastReconnectAttempt : null;
        const minutesAgo = timeSinceLastServer ? Math.round(timeSinceLastServer / 60000) : 'never';

        if (timeSinceLastServer === null) {
            debugLog(`Heartbeat: no server snapshot received yet`);
        } else if (timeSinceLastServer > STALE_THRESHOLD) {
            // Check if we recently tried to reconnect - if so, wait for it to take effect
            if (timeSinceLastReconnect !== null && timeSinceLastReconnect < RECONNECT_COOLDOWN) {
                const cooldownRemaining = Math.round((RECONNECT_COOLDOWN - timeSinceLastReconnect) / 1000);
                debugLog(`Heartbeat: connection stale but recently reconnected, waiting ${cooldownRemaining}s before retry`);
            } else {
                debugLog(`Heartbeat: last server snapshot ${minutesAgo}m ago - STALE, forcing token refresh and reconnect`);
                lastReconnectAttempt = now;
                await forceTokenRefresh();
                subscribeToRoom();
            }
        } else {
            debugLog(`Heartbeat: last server snapshot ${minutesAgo}m ago - connection OK`);
        }
    }, HEARTBEAT_INTERVAL);

    debugLog('Heartbeat monitoring started (every 5 minutes)');

    // Resubscribe when the page becomes visible again (e.g., after sleep/tab switch)
    document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState === 'visible') {
            const now = Date.now();
            const timeSinceLastServer = lastServerSnapshotTime ? now - lastServerSnapshotTime : null;
            const timeSinceLastReconnect = lastReconnectAttempt ? now - lastReconnectAttempt : null;

            // Skip if we got a server snapshot recently (connection is working)
            if (timeSinceLastServer !== null && timeSinceLastServer < 60000) {
                debugLog('Page became visible, but got server snapshot recently - skipping');
                return;
            }

            // Skip if we recently tried to reconnect
            if (timeSinceLastReconnect !== null && timeSinceLastReconnect < RECONNECT_COOLDOWN) {
                debugLog('Page became visible, but recently reconnected - skipping');
                return;
            }

            debugLog('Page became visible, refreshing connection...');
            lastReconnectAttempt = now;
            await forceTokenRefresh();
            subscribeToRoom();
        }
    });

    // Show a default welcome message until a remote sends text
    display.setText(DEFAULT_WELCOME_TEXT);
})();

