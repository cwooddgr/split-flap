import { db, doc, onSnapshot } from './firebase-init.js';
import { SplitFlapDisplay } from './splitflap.js';

const ROOM_STORAGE_KEY = 'splitflapRoomId';

function generateRoomId(length = 6) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let id = '';
    for (let i = 0; i < length; i++) {
        id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
}

function getOrCreateRoomId() {
    let roomId = localStorage.getItem(ROOM_STORAGE_KEY);
    if (!roomId) {
        roomId = generateRoomId(6 + Math.floor(Math.random() * 3)); // 6–8 chars
        localStorage.setItem(ROOM_STORAGE_KEY, roomId);
    }
    return roomId;
}

// Dev helper to reset the room during development.
// Call window.resetSplitflapRoomId() from the console.
window.resetSplitflapRoomId = function () {
    localStorage.removeItem(ROOM_STORAGE_KEY);
    window.location.reload();
};

const roomId = getOrCreateRoomId();

// Initialize split-flap display
const display = new SplitFlapDisplay('displayBoard', 22, 4);

// Generate QR code pointing to control.html for this room
const qrElement = document.getElementById('qrcode');
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
}

// Listen to Firestore document for this room
const roomRef = doc(db, 'rooms', roomId);

onSnapshot(
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
    (error) => {
        console.error('Error listening to room document', error);
    }
);


