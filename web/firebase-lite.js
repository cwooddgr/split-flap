// Firestore for the remote: Firestore Lite, which is plain REST calls and about
// 80 KB smaller on a phone than the full SDK. The remote only writes. Lite has
// no offline queue, so a write made with no connection fails at once and the
// remote says so; it is not held and sent later (decided-by-user 2026-09-20).

import {
    getFirestore,
    doc,
    setDoc,
    serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore-lite.js";
import { app, ensureSignedIn } from './firebase-core.js';

const db = getFirestore(app);

export { db, doc, setDoc, serverTimestamp, ensureSignedIn };
