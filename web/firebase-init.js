// Firestore for the display: the full SDK, because the display needs a
// realtime listener. The remote uses firebase-lite.js.

import {
    initializeFirestore,
    doc,
    onSnapshot,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { app, ensureSignedIn, backoffMs } from './firebase-core.js';

// Long polling, not the default streaming connection. Since Safari 26.4 WebKit
// holds the last frame of a streamed response until more data arrives, so a
// display in Safari showed each message only when the next one was sent
// (firebase-js-sdk issue #9789). Long polling closes every response as soon as
// it is sent. Measured 2026-09-20 in Safari 27.0: 6 of 6 writes on time this
// way, 2 of 6 with the default. Don't go back to getFirestore(app) without
// repeating that test in Safari.
const db = initializeFirestore(app, { experimentalForceLongPolling: true });

export { db, doc, onSnapshot, ensureSignedIn, backoffMs };
