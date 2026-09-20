# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Split-Flap is a minimalist split-flap style message board with two implementations:
- **Web app**: Static HTML/CSS/JS in `web/`, for display (`index.html`) and remote control (`control.html`)
- **tvOS app**: Native SwiftUI app for Apple TV (`tvos/SplitFlapTV/`)

Both connect to the same Firebase backend (Firestore). A display generates a random `roomId`, shows a QR code linking to the remote, and listens for real-time updates. The remote writes text to `rooms/{roomId}` in Firestore, and the display animates split-flap tiles to show it.

## Running Locally

### Web App (no build step, no dependencies)

```bash
python -m http.server 8000 -d web
# Open http://localhost:8000/index.html on display
# Scan QR code with phone to get control.html link
```

The web app is pure static files using ES modules (`import`/`export`). Firebase SDK is loaded via CDN in `firebase-init.js`. A page loaded from a local server still signs in to the production Firebase project.

**Deploy:** `.github/workflows/pages.yml` publishes `web/`, and only `web/`, to `flipflap.dgrlabs.co` on every push to `main` that touches it (since 2026-09-20; before that GitHub Pages served the whole repo root, notes and tvOS sources included). The custom domain lives in the repo's Pages settings; the root `CNAME` file is ignored by a workflow deploy and is kept only so a rollback to branch publishing would work. `web/control.html` must keep its name and place, because the shipped tvOS app hardcodes `https://flipflap.dgrlabs.co/control.html`. Anything that should not be public on the product domain stays out of `web/`.

### tvOS App

Current version: **1.1** (build 2), live on the App Store since 2026-07-10 (App Store lookup, 2026-09-19). **`main` is ahead of 1.1** (as of 2026-09-20; nothing submitted, 1.2 not scheduled, decided-by-user that day to cut it later): the audio session is set to `.ambient` at launch so the app no longer stops the user's music (1.1 does, at the first flap; confirmed on a device), the audio engine restarts after a route change (never reproduced), and the layout is the new fixture-tested port (breaks long words across lines, folds accents, no triple spaces). Put those in What's New when 1.2 is drafted. Bundle ID `co.dgrlabs.flipflap`, deployment target tvOS 17.0. Bump `MARKETING_VERSION` and `CURRENT_PROJECT_VERSION` in `tvos/SplitFlapTV/Version.xcconfig`, the one place they live (since 2026-09-20 it is the project's base configuration for Debug and Release; the pbxproj no longer sets either).

```bash
open tvos/SplitFlapTV/SplitFlapTV.xcodeproj
# GoogleService-Info.plist is tracked in the repo; nothing to download
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

### Web App (`web/`)
- `layout.js` - Pure layout: `CHARSET` and `layoutText(text, cols, rows)`, no DOM. The spec for it is `shared/layout-fixtures.json`
- `splitflap.js` - Core `SplitFlapDisplay` class: rendering engine, animation loop, sound (layout comes from `layout.js`)
- `display.js` - Display page: room creation, Firebase `onSnapshot` listener, QR code
- `control.js` - Remote page: text input, preset quotes, Firebase writes
- `firebase-init.js` - Firebase config, initialization, auth helpers (shared by display + control)

### tvOS App (`tvos/SplitFlapTV/SplitFlapTV/`)
- `ContentView.swift` - Root view: room ID generation, QR code toggle, board container
- `ViewModels/RoomViewModel.swift` - Firebase subscription, anonymous auth, room state
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

History: until 2026-09-20 the ports disagreed (the Swift one turned a double space into a triple space on a wrapping line, and both uppercased after wrapping so `ß` could overflow). The shipped tvOS 1.1 still has the old Swift layout; the new one ships with 1.2. The web display got the new layout the day it was pushed.

Character set: Space, A-Z, 0-9, common punctuation, smart quotes, degree symbol, dashes (73 chars total, defined in `layout.js` and `Layout/BoardCharset.swift`; the tests check both against the fixture file).

## tvOS Animation Architecture

The tvOS app uses a centralized animation coordinator (single `Task` with a timer loop) instead of per-tile async tasks. One animation tick advances all tiles one step through `CHARSET` toward their targets, with one batched state update per tick (`tickInterval` = 60 ms in `BoardView.swift`; each flap takes 40 ms plus up to 18 ms of per-tile stagger). The board is a single `Canvas` that draws cached glyph half-images, so no text is laid out per frame. Both decisions came out of the July 2026 performance work on the A10X and are critical on Apple TV hardware; don't undo either without new measurements.

The web display has not had the same treatment. `splitflap.js` still runs one `setTimeout` chain per tile, creates and removes a DOM node per step, and synthesizes a fresh noise buffer per click.

## Firestore Document Shape

```jsonc
// Collection: rooms, Document: {roomId}
{
  "text": "MESSAGE HERE",           // required - raw text with \n for newlines
  "source": "manual",               // optional - "manual" | "random" | "funny" | "clear" | a holiday key
  "updatedAt": "<serverTimestamp>", // optional - for debugging
  "expiresAt": "<timestamp>"        // optional - TTL cleanup (7 days)
}
```

`source` is whatever `control.js` passes to `sendText`. Near a holiday the Funny Quote button sends that holiday's key instead of `"funny"` (`newyears`, `valentines`, `stpatricks`, `easter`, `aprilfools`, `mothers`, `memorial`, `fathers`, `independence`, `labor`, `halloween`, `veterans`, `thanksgiving`, `christmas`). Displays ignore the field. Only the web remote writes in release builds; neither display ever creates or writes the room document.

## Firebase Requirements

- **Cloud Firestore** enabled (Native mode)
- **Anonymous authentication** enabled
- **Authorized domains** configured (Firebase Console → Authentication → Settings → Authorized domains)
- **API keys** (verified with `gcloud services api-keys list`, 2026-09-19): the web key in `firebase-init.js` is the "Browser key", limited to the Firestore and Identity Toolkit APIs with no HTTP referrer restriction (left that way, decided-by-user 2026-09-19). **Fixed 2026-09-20 (decided-by-user): the key now also allows `securetoken.googleapis.com`**, and a test refresh with the web key returned 200. Until then the list was a defect, not hardening (found 2026-09-19): it left out `securetoken.googleapis.com` (Token Service API), which Firebase Auth uses to refresh ID tokens, so every web refresh failed (45 of 45 requests with this key returned 403 in the 41 days to 2026-09-19, against 269 of 269 returning 200 for the tvOS app's key). Web auth died about an hour after page load, and the health-check, 403-interceptor, and force-reauth code in `display.js` recovered by creating a new anonymous user; `control.js` had no recovery. The soak read clean on 2026-09-20 (a display tab open for two hours refreshed at 55 and 110 minutes, 200 each time, no 403 and no new sign-up beside either), and that scaffolding was deleted the same day: `display.js` keeps one listener and resubscribes with backoff only if it errors, and nothing in the web app signs out. Don't bring any of it back for a "connection" problem without first checking the key's API list and the rules (see `docs/AUDIT_2026-09.md`). Never restrict this key to fewer than those three APIs. The shipped tvOS app uses the key Firebase named "iOS key" (Firebase registers a tvOS app as an iOS app); it has been in `GoogleService-Info.plist` since 2026-02-14, before 1.0 shipped, so never delete it. The key named "tvOS key" is the one with the `co.dgrlabs.flipflap` bundle restriction, but no shipped build uses it (0 requests in the 42 days to 2026-09-19).
- Web config in `firebase-init.js`, tvOS config via `GoogleService-Info.plist`

### Firestore Security Rules

The rules live in `firestore.rules` at the repo root; that file is the source of truth, so don't copy them into docs (a copy here drifted from the deployed rules between 2025-12 and 2026-09). Deploy with:

```bash
firebase deploy --only firestore:rules   # project comes from .firebaserc
```

The `rooms` collection must be explicitly allowed. Without this, real-time `onSnapshot` listeners will fail silently.

Key points:
- `request.auth != null` allows anonymous auth (used by both web and tvOS)
- Reads are `allow get` only, so nobody can query the collection. An earlier version of this file said `onSnapshot()` needs `read` and not `get`; that was folklore. Firebase's rules docs say `get` applies to single-document reads and `list` to queries, and a single-document listener is a `get`. **Deployed 2026-09-20 at 17:26 UTC** (Charlie ran the deploy; the live ruleset matched `firestore.rules` byte for byte). `listener_check.mjs --strict` passed right after, which is the live proof that a single-document listener works under `get`: the listener delivered a server-confirmed write, and a collection query, an extra field, a missing `expiresAt`, and a 1,001-character `text` were each refused. The previous, looser rules are in commit `6a39f00` if a rollback is ever needed
- Room IDs must match `^[A-Z0-9]{4,12}$` (both clients generate 6–8 characters)
- A write is judged on the whole document after the merge: only `text`, `source`, `updatedAt`, and `expiresAt` may exist; `text` is a string of at most 1,000 characters (the remote's textarea has the same `maxlength`); `expiresAt` is required, a timestamp, and less than 30 days out (the remote sends the phone's clock plus 7 days); `source` is a string of at most 32 characters; `updatedAt` is a timestamp. Anything a client adds to the document shape has to be added to the rules first, or the write is refused without any message in the remote's UI
- Test before deploying: `python3 tests/rules_test.py` runs a table of allow and deny cases through Google's stateless rules-test API (no emulator, no Java, touches no data). After deploying: `cd tests && npm install && node listener_check.mjs --strict` runs the real SDK against production (sign in, listen, write, and check the forbidden writes are refused); it prints a uid and room to delete afterwards
- No client deletes rooms. The `expiresAt` TTL policy removes them server-side, so delete is denied

## Audit and plan

`docs/AUDIT_2026-09.md` is the September 2026 from-scratch audit and the prioritized plan that came out of it (proposed-by-agent 2026-09-19; no item is approved until Charlie says so). Read it before touching the connection code in `display.js` or `RoomViewModel.swift`, the rules, or the layout ports.
