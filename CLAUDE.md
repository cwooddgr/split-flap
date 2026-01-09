# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Split-Flap is a minimalist split-flap style message board with two implementations:
- **Web app**: Static HTML/CSS/JS for display (`index.html`) and remote control (`control.html`)
- **tvOS app**: Native SwiftUI app for Apple TV (`tvos/SplitFlapTV/`)

Both platforms connect to the same Firebase backend (Firestore) and share a unified protocol. The display shows a 21×6 grid of animated split-flap tiles; a separate remote sends text to display via Firebase.

## Running Locally

### Web App (no build required)

```bash
python -m http.server 8000
# Open http://localhost:8000/index.html on display
# Scan QR code with phone to get control.html link
```

### tvOS App

1. Open `tvos/SplitFlapTV/SplitFlapTV.xcodeproj` in Xcode
2. Ensure `GoogleService-Info.plist` is in the project (from Firebase console)
3. Build and run (Cmd+R) on tvOS simulator or Apple TV device

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
    │  - Renders board │   │- Writes text │
    │  - Shows QR code │   │- Preset msgs │
    └──────────────────┘   └──────────────┘
              ↑
    ┌─────────┴────────┐
    │   tvOS Display   │
    │ (SplitFlapTV)    │
    │  - SwiftUI board │
    │  - Same protocol │
    └──────────────────┘
```

**Flow**: Display generates random `roomId` → shows QR code linking to remote → remote writes to `rooms/{roomId}` → display receives real-time update → animates split-flap tiles.

## Key Files

### Web App
- `splitflap.js` - Core split-flap rendering engine (animation, layout, sound)
- `display.js` - Display page logic (room creation, Firebase listener)
- `control.js` - Remote page logic (text input, preset quotes)
- `firebase-init.js` - Firebase configuration and initialization

### tvOS App (`tvos/SplitFlapTV/SplitFlapTV/`)
- `ViewModels/RoomViewModel.swift` - Firebase subscription, room state management
- `Views/BoardView.swift` - 21×6 grid rendering
- `Views/BoardLayout.swift` - Word-wrap and centering logic (port of JS)
- `Views/TileView.swift` - Split-flap tile animation
- `SoundEffects.swift` - Click sound via AVAudioEngine

### Protocol
- `docs/PROTOCOL.md` - Canonical Firestore document shape and contracts
- `shared/protocol.ts` - TypeScript interfaces (documentation only, not runtime)

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

## Layout Algorithm

Both web and tvOS implement the same layout:
1. Split text on `\n` into logical lines
2. Word-wrap each line at spaces to fit 21 columns
3. Horizontally center based on widest line
4. Vertically center within 6 rows
5. All text is uppercased

Character set: Space, A-Z, 0-9, common punctuation, smart quotes, degree symbol, dashes (74 chars total, defined in `CHARSET` constant).

## Firebase Requirements

- **Cloud Firestore** enabled (Native mode)
- **Anonymous authentication** enabled
- **Authorized domains** configured (Firebase Console → Authentication → Settings → Authorized domains)
- **API key** configured with correct referrer restrictions (Google Cloud Console → APIs & Services → Credentials)
- Web config in `firebase-init.js`
- tvOS config via `GoogleService-Info.plist`

### Firestore Security Rules

The `rooms` collection must be explicitly allowed in your security rules. Without this, real-time listeners will fail silently:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Split-flap rooms - authenticated users can read/write
    match /rooms/{roomId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
        && request.resource.data.text is string
        && request.resource.data.text.size() <= 10000;
    }

    // Deny all other access by default
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

Key points:
- `request.auth != null` allows anonymous auth (used by both web and tvOS)
- Use `allow read` (not `allow get`) to support `onSnapshot()` real-time listeners
- The catch-all deny rule blocks access to any other collections
