// Shared Firebase initialization module
// Fill in firebaseConfig with your own project's settings.

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import {
    initializeFirestore,
    doc,
    setDoc,
    onSnapshot,
    serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import {
    getAuth,
    signInAnonymously,
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAkjqv51L8eQe4QuieKo46yvYFu5iwo7FM",
    authDomain: "split-flap-ff40a.firebaseapp.com",
    projectId: "split-flap-ff40a",
    storageBucket: "split-flap-ff40a.firebasestorage.app",
    messagingSenderId: "213114555372",
    appId: "1:213114555372:web:17edd00743da2248658ec9",
};

const app = initializeApp(firebaseConfig);
// Long polling, not the default streaming connection. Since Safari 26.4 WebKit
// holds the last frame of a streamed response until more data arrives, so a
// display in Safari showed each message only when the next one was sent
// (firebase-js-sdk issue #9789). Long polling closes every response as soon as
// it is sent. Measured 2026-09-20 in Safari 27.0: 6 of 6 writes on time this
// way, 2 of 6 with the default. Don't go back to getFirestore(app) without
// repeating that test in Safari.
const db = initializeFirestore(app, { experimentalForceLongPolling: true });
const auth = getAuth(app);

// Retry delays: 1 s, 2 s, 4 s, ... capped at a minute.
function backoffMs(attempt) {
    return Math.min(60000, 1000 * 2 ** attempt);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Resolves once there is an anonymous user, retrying for as long as it takes.
// signInAnonymously returns the persisted user when the browser already has
// one. After this the SDK keeps the ID token fresh by itself; it needs the
// API key to allow securetoken.googleapis.com for that (see CLAUDE.md).
// Never sign out to "fix" a connection: that makes a new account every time.
async function ensureSignedIn(onRetry) {
    for (let attempt = 0; ; attempt++) {
        try {
            const { user } = await signInAnonymously(auth);
            return user;
        } catch (err) {
            console.error("Anonymous sign-in failed, will retry", err);
            if (onRetry) onRetry(err);
            await sleep(backoffMs(attempt));
        }
    }
}

export { db, doc, setDoc, onSnapshot, serverTimestamp, ensureSignedIn, backoffMs };
