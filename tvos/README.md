# Flip Flap tvOS

Native tvOS client for the Flip Flap split-flap message board. Mirrors the web display behavior on Apple TV, connects to the same Firebase backend, and renders a 21×8 split-flap grid in SwiftUI.

- **Current version**: 1.1 (build 3); 1.2 (build 3) uploaded 2026-09-21, not yet submitted
- **Bundle ID**: `co.dgrlabs.flipflap`
- **Deployment target**: tvOS 17.0
- **Devices**: Apple TV HD (4th gen), Apple TV 4K (all generations)

## Project layout

```
SplitFlapTV/
  SplitFlapTV.xcodeproj
  SplitFlapTV/
    FlipFlapApp.swift             # @main entry point
    ContentView.swift             # Root view: room ID, QR toggle, board
    SoundEffects.swift            # Recorded clack samples played through AVAudioEngine
    Sounds/                       # 12 clack samples (.caf)
    GoogleService-Info.plist      # Firebase config (tracked in git)
    PrivacyInfo.xcprivacy         # Privacy manifest
    AutoTestDriver.swift          # DEBUG-only latency harness
    MainThreadWatchdog.swift      # DEBUG-only main-thread stall detector
    DebugLog.swift                # Logging that compiles to nothing in Release
    Models/
      RoomState.swift             # BoardConfig, RoomState
    ViewModels/
      RoomViewModel.swift         # Firestore subscription + anonymous auth
    Layout/                       # No UI imports; `swift test` in tvos/ builds just this folder
      BoardLayout.swift           # Word-wrap / centering (Swift port of web/layout.js)
      BoardCharset.swift          # The 73 characters and the one-step advance
    Views/
      BoardView.swift             # Canvas board, glyph cache, animation coordinator, CHARSET
      QRCodeView.swift            # QR code via CoreImage
    Assets.xcassets/              # App icon, top shelf, accent color
```

See the repository root for the canonical protocol (`docs/PROTOCOL.md`), the web client, and overall architecture notes (`CLAUDE.md`).

## Building

1. Open `SplitFlapTV/SplitFlapTV.xcodeproj` in Xcode.
2. `GoogleService-Info.plist` is tracked in this repo and points at our Firebase project. If you are building your own copy, replace it with the plist for your own Firebase app.
3. Firebase dependencies are managed via Swift Package Manager, and Xcode resolves them automatically on first build.
4. Select a tvOS 17+ simulator or Apple TV device and Build & Run (⌘R).

## Architecture notes

- **Animation coordinator**: a single `Task` advances all tiles one step per 60 ms tick, with one batched state update per tick. Per-tile async tasks were too slow on A8 hardware (see commits `affa884` and `f76b6c6`).
- **Rendering**: the whole board is one `Canvas` in a `TimelineView`, drawing pre-rendered glyph half-images from a cache. Drawing text every frame took 20 seconds or more to settle a full board on an A10X; the cached images brought that to about 4.5 seconds (commit `1014b5b`).
- **Layout**: 21 columns × 8 rows (web uses 21 × 6). Both platforms share the same word-wrap + centering algorithm and 73-character `CHARSET`.
- **Connection resilience**: the app forces a fresh anonymous auth on wake and uses listener teardown/rebuild on reconnect rather than `enableNetwork`.

## Screenshots

App Store screenshots live in `../Flip Flap tvOS Screenshots/`.
