// Shared Firebase initialization module
// Fill in firebaseConfig with your own project's settings.

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import {
    getFirestore,
    doc,
    setDoc,
    onSnapshot,
    serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import {
    getAuth,
    signInAnonymously,
    onAuthStateChanged,
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
const db = getFirestore(app);
const auth = getAuth(app);

// Ensure we have an authenticated (anonymous) user before using Firestore.
function ensureSignedIn() {
    return new Promise((resolve, reject) => {
        if (auth.currentUser) {
            resolve(auth.currentUser);
            return;
        }

        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                unsubscribe();
                resolve(user);
            }
        });

        signInAnonymously(auth).catch((err) => {
            console.error("Anonymous sign-in failed", err);
            unsubscribe();
            reject(err);
        });
    });
}

// Try to refresh auth. Returns true if we should resubscribe.
async function forceTokenRefresh() {
    console.log('[Firebase] Attempting to refresh auth...');

    try {
        // Try token refresh first
        if (auth.currentUser) {
            await auth.currentUser.getIdToken(true);
            console.log('[Firebase] Token refreshed successfully');
        } else {
            await signInAnonymously(auth);
            console.log('[Firebase] Signed in anonymously');
        }
    } catch (err) {
        // Token refresh often fails due to Safari ITP blocking securetoken.googleapis.com
        // Fall back to anonymous sign-in
        console.warn('[Firebase] Token refresh failed, trying anonymous sign-in:', err.message);
        try {
            await signInAnonymously(auth);
            console.log('[Firebase] Signed in anonymously (fallback)');
        } catch (signInErr) {
            console.error('[Firebase] Anonymous sign-in also failed:', signInErr.message);
            return false;
        }
    }

    return true;
}

export { db, doc, setDoc, onSnapshot, serverTimestamp, ensureSignedIn, forceTokenRefresh };
