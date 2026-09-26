# Architecture

> **Author:** Claude Code (coder) · **Date:** 2026-09-26 · **Status:** moved verbatim from `CLAUDE.md` when it was slimmed (decided-by-user 2026-09-26); provenance stamps inside the text are the originals.

## Project Overview

Split-Flap is a minimalist split-flap style message board with two implementations:
- **Web app**: Static HTML/CSS/JS in `web/`, for display (`index.html`) and remote control (`control.html`)
- **tvOS app**: Native SwiftUI app for Apple TV (`tvos/SplitFlapTV/`)

Both connect to the same Firebase backend (Firestore). A display generates a random `roomId`, shows a QR code linking to the remote, and listens for real-time updates. The remote writes text to `rooms/{roomId}` in Firestore, and the display animates split-flap tiles to show it.

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

### Web App (`web/`)
- `layout.js` - Pure layout: `CHARSET` and `layoutText(text, cols, rows)`, no DOM. The spec for it is `shared/layout-fixtures.json`
- `splitflap.js` - Core `SplitFlapDisplay` class: the board and its one animation clock (layout comes from `layout.js`, sound from `sound.js`)
- `sound.js` - `FlipSound`: the tvOS app's 12 recorded clacks, a few per tick with random gain and timing, through one gain and a compressor. `clacks.wav` is those 12 samples end to end (3,527 frames each, made from `tvos/.../Sounds/*.caf` with `afconvert` and Python's `wave`)
- `display.js` - Display page: room creation, Firebase `onSnapshot` listener, QR code
- `vendor/qrcode-generator.mjs` - Kazuhiko Arase's `qrcode-generator` 2.0.4 (MIT), `dist/qrcode.mjs` from the npm package, unmodified. `display.js` draws the QR code with it; nothing is loaded from a CDN except the Firebase SDK (12.19.0 from gstatic)
- `control.js` - Remote page: text input, preset quotes, Firebase writes
- `firebase-core.js` - Firebase config, the app, anonymous auth, `ensureSignedIn`, and `backoffMs` (shared by display + control)
- `firebase-init.js` - Firestore for the display: the full SDK with forced long polling
- `firebase-lite.js` - Firestore for the remote: Firestore Lite (REST, 37 KB compressed against 179 KB for the full SDK). **Lite has no offline queue (decided-by-user 2026-09-20, Charlie's "1b"):** a send with no connection fails at once, the remote says "Couldn't send. Try again.", and nothing is sent later

### tvOS App (`tvos/SplitFlapTV/SplitFlapTV/`)
- `ContentView.swift` - Root view: room ID generation, QR code toggle, board container
- `ViewModels/RoomViewModel.swift` - Anonymous sign-in with backoff, one Firestore listener for the life of the app, room state, and `showsReconnecting` (from snapshot metadata, after 5 s of trouble). The same shape as `web/display.js`
- `Views/BoardView.swift` - The whole board as one `Canvas` inside a `TimelineView`, drawn from a cache of pre-rendered glyph half-images, plus the animation coordinator (all in one file; there is no per-tile view since 1.1)
- `Layout/BoardLayout.swift` - Word-wrap and centering logic (Swift port of `layout.js`)
- `Layout/BoardCharset.swift` - The 73-character charset and the one-step `advance`. The `Layout/` folder has no UI imports, so `tvos/Package.swift` can build it alone for tests
- `Views/QRCodeView.swift` - QR code rendering via CoreImage
- `Models/RoomState.swift` - `BoardConfig` and `RoomState` structs
- `SoundEffects.swift` - `FlipSoundPlayer`: 12 recorded clack samples (`Sounds/*.caf`) through a pool of `AVAudioPlayerNode`s on one `AVAudioEngine`, with random gain and jitter per tick
- `AutoTestDriver.swift`, `MainThreadWatchdog.swift`, `DebugLog.swift` - Latency harness and logging, all inside `#if DEBUG`. `AutoTestDriver` is on only when the app is launched with the `-AutoTest` argument (a source-level flag until 2026-09-20), and when on it writes to the production Firestore project (rooms `DBGTEST1` and `DBGMETR1`). Its metrics document packs JSON into `text`, so the 1,000-character rule will refuse it once it grows past that

### Protocol
- `docs/PROTOCOL.md` - Canonical Firestore document shape and contracts

## Board Dimensions

The two platforms use different grid sizes:
- **Web**: 21 columns × 6 rows (in `display.js`: `new SplitFlapDisplay('displayBoard', 21, 6)`)
- **tvOS**: 21 columns × 8 rows (in `ContentView.swift`: `BoardConfig(cols: 21, rows: 8)`)

Both use the same layout algorithm (word-wrap, center) and the same 73-character charset (`CHARSET` in `layout.js`, `BoardCharset` in Swift; docs said 74 until 2026-09-19).

A message with more lines than the board has rows loses the extra lines without warning. So a 7-line message that fits tvOS drops its last line on web. The remote has no preview and does not know which board size it is writing to.

## Layout Algorithm

Both web and tvOS implement the same layout, as two hand ports held together by one spec. `shared/layout-fixtures.json` lists input text, board size, and the exact expected rows; `node --test tests/layout.test.mjs` and `cd tvos && swift test` both run it, and `.github/workflows/tests.yml` runs both on every push. **To change layout behavior, change or add a fixture first, then make both ports pass.** The steps:
1. Sanitize before measuring: CRLF and CR become `\n`, accents fold to the base letter (NFD, then drop U+0300–U+036F), uppercase (so `ß` is already `SS` when it's measured), and every code point outside the charset becomes a space
2. Split text on `\n` into logical lines
3. Word-wrap each line at spaces to fit 21 columns. Runs of spaces inside a line are kept; a word longer than the board is broken across lines (it used to be cut off, which ate URLs)
4. Drop lines past the last row
5. Horizontally center based on widest line; lines stay left-justified in the block
6. Vertically center within available rows; an odd spare row goes below

History: until 2026-09-20 the ports disagreed (the Swift one turned a double space into a triple space on a wrapping line, and both uppercased after wrapping so `ß` could overflow). tvOS 1.1 and earlier have the old Swift layout; the new one shipped in 1.2 (live 2026-09-21). The web display got the new layout the day it was pushed.

Character set: Space, A-Z, 0-9, common punctuation, smart quotes, degree symbol, dashes (73 chars total, defined in `layout.js` and `Layout/BoardCharset.swift`; the tests check both against the fixture file).

## tvOS Animation Architecture

The tvOS app uses a centralized animation coordinator (single `Task` with a timer loop) instead of per-tile async tasks. One animation tick advances all tiles one step through `CHARSET` toward their targets, with one batched state update per tick (`tickInterval` = 60 ms in `BoardView.swift`; each flap takes 40 ms plus up to 18 ms of per-tile stagger). The board is a single `Canvas` that draws cached glyph half-images, so no text is laid out per frame. Both decisions came out of the July 2026 performance work on the A10X and are critical on Apple TV hardware; don't undo either without new measurements.

The web display follows the same design since 2026-09-20 (live that day, `da2314d`; how it was checked is in the Phase 4 status note in `docs/AUDIT_2026-09.md`). `splitflap.js` runs one `requestAnimationFrame` clock with the tvOS timings (60 ms tick, 40 ms flap, up to 18 ms stagger). Each tile keeps four faces in the DOM, and its two moving faces each own one Web Animations `Animation` that is made at init and replayed per flip, so nothing is created while the board runs. A late frame advances tiles by every tick it missed, so a slow machine skips steps and keeps the duration. The board jumps straight to its target, silently, when the tab is hidden or `prefers-reduced-motion` is set. Tile size comes from one CSS unit (`--u` on `.display-board`, the largest tile that fits the window both ways), so the board has no maximum size. **The QR code stays on screen until the person at the display clicks to hide it (decided-by-user 2026-09-20, about the web display, after an auto-hide on the first message went live without his approval).** It is as it was before that day: 112 px at the bottom right, with 120 px kept free under the board (80 px on windows 1400 px and wider).


## Running Locally

### Web App (no build step, no dependencies)

```bash
python -m http.server 8000 -d web
# Open http://localhost:8000/index.html on display
# Scan QR code with phone to get control.html link
```

The web app is pure static files using ES modules (`import`/`export`). The Firebase SDK is loaded from Google's CDN in `firebase-core.js`, `firebase-init.js`, and `firebase-lite.js`. A page loaded from a local server still signs in to the production Firebase project.

### tvOS App

```bash
open tvos/SplitFlapTV/SplitFlapTV.xcodeproj
# GoogleService-Info.plist is tracked in the repo; nothing to download
# Build and run (Cmd+R) on tvOS simulator or Apple TV device
```

Firebase SDK is managed via Swift Package Manager (configured in the Xcode project). No CocoaPods or Carthage.

## Audit and plan

`docs/AUDIT_2026-09.md` is the September 2026 from-scratch audit and the prioritized plan that came out of it (proposed-by-agent 2026-09-19; no item is approved until Charlie says so). Read it before touching the connection code in `display.js` or `RoomViewModel.swift`, the rules, or the layout ports.
