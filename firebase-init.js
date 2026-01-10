// Shared Firebase initialization module
// Fill in firebaseConfig with your own project's settings.

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import {
    getFirestore,
    doc,
    setDoc,
    getDoc,
    onSnapshot,
    serverTimestamp,
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import {
    getAuth,
    signInAnonymously,
    signOut,
    onAuthStateChanged,
    getIdToken,
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

// Force a fresh anonymous sign-in by signing out first.
// Use this when the auth token may have expired.
async function forceReauthenticate() {
    try {
        await signOut(auth);
    } catch (err) {
        console.warn("Sign out failed (may already be signed out):", err);
    }
    return signInAnonymously(auth);
}

// Proactively refresh the auth token before it expires.
// Call this periodically (e.g., every 55 minutes) to avoid token expiry gaps.
async function refreshAuthToken() {
    if (!auth.currentUser) {
        return null;
    }
    // Force refresh by passing true
    return getIdToken(auth.currentUser, true);
}

export { db, doc, setDoc, getDoc, onSnapshot, serverTimestamp, ensureSignedIn, forceReauthenticate, refreshAuthToken };
