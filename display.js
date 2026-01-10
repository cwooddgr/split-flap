import { db, doc, getDoc, onSnapshot, ensureSignedIn } from './firebase-init.js';
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
let connectionEstablishedTime = null;
let isConnected = true;
let snapshotCount = 0;
let serverResponseCount = 0;
let cacheResponseCount = 0;
let unsubscribeListener = null;
let reconnectCount = 0;

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
        reconnectCount,
    });
}

const pageLoadTime = Date.now();
debugLog('INIT', 'Health check system initialized', {
    HEALTH_CHECK_INTERVAL_MS,
    OFFLINE_THRESHOLD_MS,
});

function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) {
        return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
}

function setConnectionState(connected) {
    if (isConnected === connected) {
        debugLog('STATE', `Connection state unchanged: ${connected}`);
        return;
    }
    const previousState = isConnected;
    isConnected = connected;
    document.body.classList.toggle('disconnected', !connected);
    if (!connected) {
        const now = Date.now();
        const timeSinceEstablished = connectionEstablishedTime ? now - connectionEstablishedTime : null;
        const timeSinceLastUsed = now - lastServerResponseTime;

        // Prominent, easily searchable connection lost message
        console.error(`
========================================
CONNECTION LOST - ${new Date().toISOString()}
========================================
Time since connection established: ${timeSinceEstablished ? formatDuration(timeSinceEstablished) : 'N/A'}
Time since last server response:   ${formatDuration(timeSinceLastUsed)}
Connection established at:         ${connectionEstablishedTime ? new Date(connectionEstablishedTime).toISOString() : 'N/A'}
Last server response at:           ${new Date(lastServerResponseTime).toISOString()}
========================================
        `);

        debugLog('STATE', 'CONNECTION LOST - Background turning red', {
            previousState,
            newState: connected,
            timeSinceEstablishedMs: timeSinceEstablished,
            timeSinceLastUsedMs: timeSinceLastUsed,
        });
    } else {
        // Update connection established time on reconnect
        if (!connectionEstablishedTime || previousState === false) {
            connectionEstablishedTime = Date.now();
        }
        console.log('Connection restored to Firebase');
        debugLog('STATE', 'CONNECTION RESTORED - Background returning to normal', {
            previousState,
            newState: connected,
            connectionEstablishedTime: new Date(connectionEstablishedTime).toISOString(),
        });
    }
}

async function attemptReconnect() {
    reconnectCount++;
    debugLog('RECONNECT', 'Attempting full reconnect - teardown and rebuild listener');

    // Unsubscribe existing listener
    if (unsubscribeListener) {
        debugLog('RECONNECT', 'Unsubscribing existing listener');
        try {
            unsubscribeListener();
        } catch (err) {
            debugLog('RECONNECT', 'Error unsubscribing', { error: err.message });
        }
        unsubscribeListener = null;
    }

    try {
        // Re-authenticate (get fresh anonymous auth if needed)
        debugLog('RECONNECT', 'Re-authenticating...');
        await ensureSignedIn();
        debugLog('RECONNECT', 'Re-authentication successful');

        // Set up fresh listener
        debugLog('RECONNECT', 'Setting up new Firestore listener');
        setupFirestoreListener();

        // Check after a delay if reconnection worked
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
        }, 10000);
    } catch (err) {
        console.error('Failed to reconnect:', err);
        debugLog('RECONNECT', 'Reconnect failed', { error: err.message });
        setConnectionState(false);
    }
}

function setupFirestoreListener() {
    const roomRef = doc(db, 'rooms', roomId);
    debugLog('LISTENER', 'Setting up Firestore listener', { roomId });

    unsubscribeListener = onSnapshot(
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
                if (!connectionEstablishedTime) {
                    connectionEstablishedTime = Date.now();
                    debugLog('SNAPSHOT', 'First server response - connection established');
                }
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
}

function startHealthCheck() {
    debugLog('HEALTH', 'Starting health check interval');
    setInterval(async () => {
        const timeSinceLastResponse = Date.now() - lastServerResponseTime;
        debugLog('HEALTH', 'Health check tick - performing active ping', {
            timeSinceLastResponseMs: timeSinceLastResponse,
            thresholdMs: OFFLINE_THRESHOLD_MS,
        });

        // Active ping: try to read the room document from the server
        try {
            const roomRef = doc(db, 'rooms', roomId);
            const snapshot = await getDoc(roomRef);
            const fromCache = snapshot.metadata.fromCache;

            debugLog('HEALTH', 'Ping response received', {
                fromCache,
                exists: snapshot.exists(),
            });

            if (!fromCache) {
                // Got a fresh server response - connection is alive
                lastServerResponseTime = Date.now();
                setConnectionState(true);
                debugLog('HEALTH', 'Ping successful - connection confirmed alive');
            } else {
                // Only got cached data - server might be unreachable
                debugLog('HEALTH', 'Ping returned cached data - checking threshold');
                const updatedTimeSinceLastResponse = Date.now() - lastServerResponseTime;
                if (updatedTimeSinceLastResponse > OFFLINE_THRESHOLD_MS) {
                    debugLog('HEALTH', 'Over threshold after cache response - attempting reconnect');
                    setConnectionState(false);
                    attemptReconnect();
                }
            }
        } catch (err) {
            console.error('Health check ping failed:', err);
            debugLog('HEALTH', 'Ping failed with error', {
                errorMessage: err.message,
                errorCode: err.code,
            });
            const updatedTimeSinceLastResponse = Date.now() - lastServerResponseTime;
            if (updatedTimeSinceLastResponse > OFFLINE_THRESHOLD_MS) {
                setConnectionState(false);
                attemptReconnect();
            }
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

    // Set up Firestore listener and start health check
    setupFirestoreListener();
    startHealthCheck();

    // Show a default welcome message until a remote sends text
    display.setText(DEFAULT_WELCOME_TEXT);
})();

