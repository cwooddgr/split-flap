## Split‑Flap

A minimalist split‑flap style message board that runs on the web (for the display and remote) and on Apple TV (tvOS).  
The display shows a grid of animated split‑flap cells; a separate “remote” page or the tvOS app sends text to show via Firebase.

---

## Features

- **Big‑screen display**: Full‑screen split‑flap board (`index.html`) intended for an iPad or desktop display.
- **Remote control**: Phone‑friendly remote (`control.html`) to type or pick predefined messages.
- **Room pairing via QR code**:
  - The display generates a **room id** and shows a QR code.
  - Scanning the QR code opens the remote page already bound to that room.
- **Animated board**: Characters animate in a split‑flap style as the text changes.
- **Fun presets**:
  - “Random Quote” button with humorous sayings.
  - "Funny Quote" button with humorous one-liners.
- **Automatic cleanup**:
  - Each room document stores an `expiresAt` field.
  - You can configure Firestore TTL to delete rooms after they are stale (e.g., 7 days).
- **tvOS app**:
  - Mirrors the web display behavior on Apple TV.
  - Connects to the same Firebase project and room documents.

---

## Project Structure

- **Web app (static site)**
  - `index.html` – Display page for the board.
  - `control.html` – Remote controller UI for phones.
  - `style.css` – Shared styling for display and remote.
  - `splitflap.js` – Split‑flap board rendering and animation.
  - `display.js` – Wires the display page to Firebase + QR code.
  - `control.js` – Wires the remote page to Firebase and presets.
  - `firebase-init.js` – Shared Firebase initialization (web).
  - `shared/protocol.ts` – Shared TypeScript description of the room protocol.
  - `docs/PROTOCOL.md` – Human‑readable description of the Firestore data model and protocol.

- **tvOS app**
  - `tvos/README.md` – tvOS‑specific notes.
  - `tvos/SplitFlapTV/` – SwiftUI tvOS project.
    - `SplitFlapTVApp.swift` – App entry point.
    - `ContentView.swift` – Top‑level UI.
    - `Models/RoomState.swift` – Board/room data model.
    - `ViewModels/RoomViewModel.swift` – Binds Firestore state to the views.
    - `Views/BoardLayout.swift`, `BoardView.swift`, `QRCodeView.swift` – Main views.
    - `SoundEffects.swift` – Optional split‑flap sound effects.
    - `GoogleService-Info.plist` – Firebase config for tvOS (you provide your own).

---

## How It Works (High‑Level)

1. **Room creation (display)**  
   - When `index.html` loads, `display.js`:
     - Generates a random `roomId`.
     - Initializes Firebase (via `firebase-init.js`).
     - Shows a QR code linking to `control.html?room=<roomId>`.
     - Listens to Firestore document `rooms/<roomId>` for changes.
   - The split‑flap board shows an initial empty message (configurable).

2. **Remote control (web)**  
   - `control.html` reads the `room` from the query string or hash.
   - It signs in anonymously via Firebase Auth, then writes to `rooms/<roomId>`:
     - `text`: the multi‑line text to display.
     - `updatedAt`: Firestore server timestamp.
     - `expiresAt`: JavaScript `Date` set to “now + 7 days” (for TTL cleanup).
     - `source`: `"manual" | "random" | "funny"`.

3. **Display update**  
   - On any change to the room document, the display receives the new `text` and:
     - Computes the layout for the 21×6 board.
     - Animates character changes using the split‑flap effect.

4. **tvOS app**  
   - Uses the same `rooms/<roomId>` documents as the web display.
   - Mirrors the animation and layout behavior described in `docs/PROTOCOL.md`.
   - Can show/hide the QR code using the Siri Remote.

---

## Prerequisites

- A **Firebase project** with:
  - **Cloud Firestore** enabled (in Native mode).
  - **Firebase Authentication** enabled with **Anonymous** sign‑in.
- A **Google Cloud project** linked to your Firebase project (automatically created by Firebase).
- Node not required: the web app is just static HTML/JS/CSS and can be hosted anywhere.
- For tvOS:
  - **Xcode** (latest stable) on macOS.
  - An Apple TV or tvOS simulator.

---

## Firebase Configuration (Web)

1. In the Firebase console, go to **Project settings → General → Your apps**.
2. Under **Web apps**, either:
   - Use the existing app for this project, or
   - Register a new web app (no hosting required).
3. Copy the `firebaseConfig` block and paste it into `firebase-init.js`:

```js
const firebaseConfig = {
  apiKey: "…",
  authDomain: "…",
  projectId: "…",
  storageBucket: "…",
  messagingSenderId: "…",
  appId: "…",
};
```

4. Make sure your **Firestore rules** only allow access to the `rooms` collection as described in `docs/PROTOCOL.md` (for example, requiring authentication and restricting fields as needed).

---

## Firebase Configuration (tvOS)

1. In the Firebase console, go to **Project settings → General → Your apps**.
2. Under **iOS apps**, either:
   - Use an existing iOS/tvOS app entry, or
   - Register a new app whose bundle ID matches the tvOS target’s bundle identifier.
3. Download the generated `GoogleService-Info.plist`.
4. In Xcode:
   - Drag `GoogleService-Info.plist` into the `SplitFlapTV` target.
   - Ensure **“Copy items if needed”** is checked and the **SplitFlapTV** target is selected in the “Add to targets” list.

The tvOS app will then use the same Firebase project and Firestore data as the web app.

---

## Running the Web App Locally

Because the app is 100% static, you can use any static file server. For example, with Python:

```bash
cd sf
python -m http.server 8000
```

Then:

1. Open `http://localhost:8000/index.html` on a big screen (iPad / desktop).  
2. Scan the QR code with your phone; it should open `control.html?room=…`.  
3. Type a message or use **Random Quote** / **Funny Quote**, then press **Display**.  
4. Watch the split‑flap board animate to the new text.

You can also host the files on any static host (Firebase Hosting, GitHub Pages, Netlify, etc.).

---

## Running the tvOS App

1. Open `tvos/SplitFlapTV/SplitFlapTV.xcodeproj` in Xcode.
2. Ensure your `GoogleService-Info.plist` is present and added to the **SplitFlapTV** target (see “Firebase Configuration (tvOS)” above).
3. Select a tvOS simulator or a physical Apple TV device.
4. Build and run.

The Apple TV display will connect to the configured room and mirror the split‑flap animation behavior of the web app.

---

## API Key Security Notes

For Firebase web and mobile apps, the `apiKey` in `firebaseConfig` is **not a secret**. It is:

- Used to identify your Firebase project to Google services.
- Expected to be embedded in client apps (web, iOS, Android, tvOS).

You should still harden it:

- In **Google Cloud Console → APIs & Services → Credentials**, find your Firebase web API key and:
  - Set **API restrictions** to only:
    - **Cloud Firestore API**
    - **Identity Toolkit API** / **Firebase Authentication API**
  - Optionally set **HTTP referrer** restrictions for your production web host.
- Rely on strong **Firestore security rules** to protect your data.

If your key was previously unrestricted, rotate it (create a new key, update `firebaseConfig` and `GoogleService-Info.plist`, then delete the old key).

---

## Firestore TTL / Cleanup

Each room document written by the remote includes an `expiresAt` field set to 7 days in the future. To automatically delete stale rooms:

1. In the Firebase console, go to **Firestore Database → TTL (Time to Live)**.
2. Create a TTL policy for the `rooms` collection targeting the `expiresAt` field.
3. Set the retention you want (for example, delete documents when `expiresAt` is older than “now”).

This keeps your Firestore data size under control without manual cleanup.

---

## License

MIT License

Copyright (c) 2025 Charlie Wood

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

