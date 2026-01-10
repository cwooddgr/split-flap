import { db, doc, onSnapshot, ensureSignedIn, enableNetwork } from './firebase-init.js';
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

// Connection health check state
const HEALTH_CHECK_INTERVAL_MS = 120000; // Check every 2 minutes
const OFFLINE_THRESHOLD_MS = 60000; // Consider offline if no server response for 60s
let lastServerResponseTime = Date.now();
let isConnected = true;
let snapshotCount = 0;
let serverResponseCount = 0;
let cacheResponseCount = 0;

function debugLog(category, message, data = {}) {
    const timestamp = new Date().toISOString();
    const uptime = Math.round((Date.now() - pageLoadTime) / 1000);
    console.log(`[${timestamp}] [${category}] [uptime: ${uptime}s] ${message}`, {
        ...data,
        isConnected,
        lastServerResponseTime: new Date(lastServerResponseTime).toISOString(),
        timeSinceLastServer: Math.round((Date.now() - lastServerResponseTime) / 1000) + 's',
        snapshotCount,
        serverResponseCount,
        cacheResponseCount,
    });
}

const pageLoadTime = Date.now();
debugLog('INIT', 'Health check system initialized', {
    HEALTH_CHECK_INTERVAL_MS,
    OFFLINE_THRESHOLD_MS,
});

function setConnectionState(connected) {
    if (isConnected === connected) {
        debugLog('STATE', `Connection state unchanged: ${connected}`);
        return;
    }
    const previousState = isConnected;
    isConnected = connected;
    document.body.classList.toggle('disconnected', !connected);
    if (!connected) {
        console.warn('Connection lost to Firebase');
        debugLog('STATE', 'CONNECTION LOST - Background turning red', {
            previousState,
            newState: connected,
        });
    } else {
        console.log('Connection restored to Firebase');
        debugLog('STATE', 'CONNECTION RESTORED - Background returning to normal', {
            previousState,
            newState: connected,
        });
    }
}

async function attemptReconnect() {
    debugLog('RECONNECT', 'Attempting to reconnect via enableNetwork()');
    try {
        await enableNetwork(db);
        debugLog('RECONNECT', 'enableNetwork() completed successfully');
        // Give it a moment to reconnect, then check if we got a server response
        setTimeout(() => {
            const timeSinceLastResponse = Date.now() - lastServerResponseTime;
            debugLog('RECONNECT', 'Post-reconnect check', {
                timeSinceLastResponseMs: timeSinceLastResponse,
                thresholdMs: OFFLINE_THRESHOLD_MS,
                stillOffline: timeSinceLastResponse > OFFLINE_THRESHOLD_MS,
            });
            if (timeSinceLastResponse > OFFLINE_THRESHOLD_MS) {
                setConnectionState(false);
            }
        }, 5000);
    } catch (err) {
        console.error('Failed to reconnect:', err);
        debugLog('RECONNECT', 'enableNetwork() failed', { error: err.message });
        setConnectionState(false);
    }
}

function startHealthCheck() {
    debugLog('HEALTH', 'Starting health check interval');
    setInterval(() => {
        const timeSinceLastResponse = Date.now() - lastServerResponseTime;
        const isOverThreshold = timeSinceLastResponse > OFFLINE_THRESHOLD_MS;
        debugLog('HEALTH', 'Health check tick', {
            timeSinceLastResponseMs: timeSinceLastResponse,
            thresholdMs: OFFLINE_THRESHOLD_MS,
            isOverThreshold,
            willAttemptReconnect: isOverThreshold,
        });
        if (isOverThreshold) {
            setConnectionState(false);
            attemptReconnect();
        }
    }, HEALTH_CHECK_INTERVAL_MS);
}

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

    // Listen to Firestore document for this room
    const roomRef = doc(db, 'rooms', roomId);
    debugLog('INIT', 'Setting up Firestore listener', { roomId });

    onSnapshot(
        roomRef,
        { includeMetadataChanges: true },
        (snapshot) => {
            snapshotCount++;
            const fromCache = snapshot.metadata.fromCache;
            const hasPendingWrites = snapshot.metadata.hasPendingWrites;

            if (fromCache) {
                cacheResponseCount++;
            } else {
                serverResponseCount++;
            }

            debugLog('SNAPSHOT', 'Received snapshot', {
                fromCache,
                hasPendingWrites,
                exists: snapshot.exists(),
                hasText: snapshot.exists() && typeof snapshot.data()?.text === 'string',
                textLength: snapshot.exists() ? snapshot.data()?.text?.length : null,
            });

            // Track connection state via metadata
            if (!fromCache) {
                lastServerResponseTime = Date.now();
                debugLog('SNAPSHOT', 'Server response - updating lastServerResponseTime');
                setConnectionState(true);
            } else {
                debugLog('SNAPSHOT', 'Cache response - NOT updating lastServerResponseTime');
            }

            if (!snapshot.exists()) {
                debugLog('SNAPSHOT', 'Document does not exist, skipping setText');
                return;
            }
            const data = snapshot.data();
            if (typeof data.text === 'string') {
                display.setText(data.text);
            }
        },
        (error) => {
            console.error('Error listening to room document', error);
            debugLog('ERROR', 'Snapshot listener error', {
                errorMessage: error.message,
                errorCode: error.code,
                errorName: error.name,
            });
            setConnectionState(false);
            attemptReconnect();
        }
    );

    // Start periodic health check
    startHealthCheck();

    // Show a default welcome message until a remote sends text
    display.setText(DEFAULT_WELCOME_TEXT);
})();

