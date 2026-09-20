// Live check of the real client path against production, using the same
// Firebase JS SDK version and web key as the site: sign in anonymously, attach
// an onSnapshot listener to one room, write the shape control.js writes, and
// see the listener deliver it. With --strict it also expects the writes the
// tightened rules forbid to be refused (don't pass it against loose rules, or
// the bad writes will land).
//
//   cd tests && npm install && node listener_check.mjs [--strict]
//
// It leaves a test room and an anonymous user behind; the uid and room are
// printed last so the caller can delete both with an admin token.
import { readFileSync } from "node:fs";
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getFirestore, doc, onSnapshot, setDoc, getDocs, collection, serverTimestamp } from "firebase/firestore";

const strict = process.argv.includes("--strict");
const ROOM = "HEALTHCHK0";
const src = readFileSync(new URL("../firebase-init.js", import.meta.url), "utf8");
const pick = (k) => src.match(new RegExp(`${k}:\\s*"([^"]+)"`))[1];
const app = initializeApp({ apiKey: pick("apiKey"), authDomain: pick("authDomain"), projectId: pick("projectId"), appId: pick("appId") });
const db = getFirestore(app);
let failed = 0;
const report = (ok, what, detail = "") => { failed += !ok; console.log(`${ok ? "ok  " : "FAIL"} ${what}${detail ? "  (" + detail + ")" : ""}`); };
const week = () => new Date(Date.now() + 7 * 24 * 3600 * 1000);
const refused = async (what, p) => {
  try { await p; report(false, what, "was allowed"); }
  catch (e) { report(e.code === "permission-denied", what, e.code); }
};

const { user } = await signInAnonymously(getAuth(app));
const ref = doc(db, "rooms", ROOM);
const stamp = `CHECK ${Date.now()}`;

const delivered = new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error("timed out after 15s")), 15000);
  onSnapshot(ref, (snap) => {
    if (snap.exists() && snap.data().text === stamp && !snap.metadata.hasPendingWrites) { clearTimeout(timer); resolve(); }
  }, (err) => { clearTimeout(timer); reject(err); });
});
delivered.catch(() => {});

try {
  await setDoc(ref, { text: stamp, updatedAt: serverTimestamp(), expiresAt: week(), source: "manual" }, { merge: true });
  report(true, "write with the shape control.js sends");
} catch (e) { report(false, "write with the shape control.js sends", e.code); }

try { await delivered; report(true, "single-document onSnapshot listener delivered the server-confirmed write"); }
catch (e) { report(false, "single-document onSnapshot listener", e.code || e.message); }

if (strict) {
  await refused("collection query is refused", getDocs(collection(db, "rooms")));
  await refused("write with an extra field is refused", setDoc(ref, { text: "X", expiresAt: week(), junk: 1 }, { merge: true }));
  await refused("write with no expiresAt is refused", setDoc(doc(db, "rooms", "HEALTHCHK1"), { text: "X" }));
  await refused("1,001-character text is refused", setDoc(ref, { text: "A".repeat(1001), expiresAt: week() }, { merge: true }));
}

console.log(`CLEANUP uid=${user.uid} room=${ROOM}`);
process.exit(failed ? 1 : 0);
