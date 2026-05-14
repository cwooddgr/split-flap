# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Split-Flap is a minimalist split-flap style message board with two implementations:
- **Web app**: Static HTML/CSS/JS for display (`index.html`) and remote control (`control.html`)
- **tvOS app**: Native SwiftUI app for Apple TV (`tvos/SplitFlapTV/`)

Both connect to the same Firebase backend (Firestore). A display generates a random `roomId`, shows a QR code linking to the remote, and listens for real-time updates. The remote writes text to `rooms/{roomId}` in Firestore, and the display animates split-flap tiles to show it.

## Running Locally

### Web App (no build step, no dependencies)

```bash
python -m http.server 8000
# Open http://localhost:8000/index.html on display
# Scan QR code with phone to get control.html link
```

The web app is pure static files using ES modules (`import`/`export`). Firebase SDK is loaded via CDN in `firebase-init.js`. Hosted at `flipflap.dgrlabs.co` (see `CNAME`).

### tvOS App

Current version: **1.1** (build 2). Bundle ID `co.dgrlabs.flipflap`, deployment target tvOS 17.0. Bump `MARKETING_VERSION` and `CURRENT_PROJECT_VERSION` in `tvos/SplitFlapTV/SplitFlapTV.xcodeproj/project.pbxproj` (two occurrences each — Debug and Release).

```bash
open tvos/SplitFlapTV/SplitFlapTV.xcodeproj
# Requires GoogleService-Info.plist from Firebase console
# Build and run (Cmd+R) on tvOS simulator or Apple TV device
```

Firebase SDK is managed via Swift Package Manager (configured in the Xcode project). No CocoaPods or Carthage.

## Architecture

```
┌─────────────────────────────────────────────┐
│         Firebase (Firestore)                │
│    Collection: rooms/{roomId}               │
│    Fields: text, source, updatedAt, expiresAt│
└─────────────────────────────────────────────┘
              ↑                    ↑
    ┌─────────┴────────┐   ┌──────┴───────┐
    │   Web Display    │   │  Web Remote  │
    │  (index.html)    │   │(control.html)│
    │  21×6 grid       │   │- Writes text │
    │  - Shows QR code │   │- Preset msgs │
    └──────────────────┘   └──────────────┘
              ↑
    ┌─────────┴────────┐
    │   tvOS Display   │
    │ (SplitFlapTV)    │
    │  21×8 grid       │
    │  - Same protocol │
    └──────────────────┘
```

## Key Files

### Web App
- `splitflap.js` - Core `SplitFlapDisplay` class: rendering engine, animation loop, layout, sound
- `display.js` - Display page: room creation, Firebase `onSnapshot` listener, QR code
- `control.js` - Remote page: text input, preset quotes, Firebase writes
- `firebase-init.js` - Firebase config, initialization, auth helpers (shared by display + control)

### tvOS App (`tvos/SplitFlapTV/SplitFlapTV/`)
- `ContentView.swift` - Root view: room ID generation, QR code toggle, board container
- `ViewModels/RoomViewModel.swift` - Firebase subscription, anonymous auth, room state
- `Views/BoardView.swift` - Grid rendering + animation coordinator + `TileView` (all in one file)
- `Views/BoardLayout.swift` - Word-wrap and centering logic (Swift port of `splitflap.js`)
- `Views/QRCodeView.swift` - QR code rendering via CoreImage
- `Models/RoomState.swift` - `BoardConfig` and `RoomState` structs
- `SoundEffects.swift` - Click sound via AVAudioEngine

### Protocol
- `docs/PROTOCOL.md` - Canonical Firestore document shape and contracts
- `shared/protocol.ts` - TypeScript interfaces (documentation only, not runtime)

## Board Dimensions

The two platforms use different grid sizes:
- **Web**: 21 columns × 6 rows (in `display.js`: `new SplitFlapDisplay('displayBoard', 21, 6)`)
- **tvOS**: 21 columns × 8 rows (in `ContentView.swift`: `BoardConfig(cols: 21, rows: 8)`)

Both use the same layout algorithm (word-wrap, center) and 74-character `CHARSET` constant.

## Layout Algorithm

Both web and tvOS implement the same layout:
1. Split text on `\n` into logical lines
2. Word-wrap each line at spaces to fit 21 columns
3. Horizontally center based on widest line
4. Vertically center within available rows
5. All text is uppercased

Character set: Space, A-Z, 0-9, common punctuation, smart quotes, degree symbol, dashes (74 chars total, defined in `CHARSET` in both `splitflap.js` and `BoardView.swift`).

## tvOS Animation Architecture

The tvOS app uses a centralized animation coordinator (single `Task` with a timer loop) instead of per-tile async tasks. One animation tick advances all tiles one step through `CHARSET` toward their targets, with a single batched `currentBoard` state update per tick (~50ms interval). This is critical for performance on Apple TV hardware.

## Firestore Document Shape

```jsonc
// Collection: rooms, Document: {roomId}
{
  "text": "MESSAGE HERE",           // required - raw text with \n for newlines
  "source": "manual",               // optional - "manual" | "random" | "funny"
  "updatedAt": "<serverTimestamp>", // optional - for debugging
  "expiresAt": "<timestamp>"        // optional - TTL cleanup (7 days)
}
```

## Firebase Requirements

- **Cloud Firestore** enabled (Native mode)
- **Anonymous authentication** enabled
- **Authorized domains** configured (Firebase Console → Authentication → Settings → Authorized domains)
- **API key** configured with correct referrer restrictions (Google Cloud Console → APIs & Services → Credentials)
- Web config in `firebase-init.js`, tvOS config via `GoogleService-Info.plist`

### Firestore Security Rules

The `rooms` collection must be explicitly allowed. Without this, real-time `onSnapshot` listeners will fail silently:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /rooms/{roomId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
        && request.resource.data.text is string
        && request.resource.data.text.size() <= 10000;
    }
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

Key points:
- `request.auth != null` allows anonymous auth (used by both web and tvOS)
- Use `allow read` (not `allow get`) to support `onSnapshot()` real-time listeners
