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

  // Your web app's Firebase configuration
  const firebaseConfig = {
    apiKey: "AIzaSyAkjqv51L8eQe4QuieKo46yvYFu5iwo7FM",
    authDomain: "split-flap-ff40a.firebaseapp.com",
    projectId: "split-flap-ff40a",
    storageBucket: "split-flap-ff40a.firebasestorage.app",
    messagingSenderId: "213114555372",
    appId: "1:213114555372:web:17edd00743da2248658ec9"
  };

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db, doc, setDoc, onSnapshot, serverTimestamp };


