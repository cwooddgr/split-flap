# Flip Flap tvOS

Native tvOS client for the Flip Flap split-flap message board. Mirrors the web display behavior on Apple TV, connects to the same Firebase backend, and renders a 21×8 split-flap grid in SwiftUI.

- **Current version**: 1.0 (build 1)
- **Bundle ID**: `co.dgrlabs.flipflap`
- **Deployment target**: tvOS 17.0
- **Devices**: Apple TV HD (4th gen), Apple TV 4K (all generations)

## Project layout

```
SplitFlapTV/
  SplitFlapTV.xcodeproj
  SplitFlapTV/
    SplitFlapTVApp.swift          # @main entry point
    ContentView.swift             # Root view: room ID, QR toggle, board
    SoundEffects.swift            # Click sound via AVAudioEngine
    GoogleService-Info.plist      # Firebase config (not in git)
    Models/
      RoomState.swift             # BoardConfig, RoomState
    ViewModels/
      RoomViewModel.swift         # Firestore subscription + anonymous auth
    Views/
      BoardView.swift             # Grid + animation coordinator + TileView
      BoardLayout.swift           # Word-wrap / centering (Swift port of splitflap.js)
      QRCodeView.swift            # QR code via CoreImage
    Assets.xcassets/              # App icon, top shelf, accent color
```

See the repository root for the canonical protocol (`docs/PROTOCOL.md`), the web client, and overall architecture notes (`CLAUDE.md`).

## Building

1. Open `SplitFlapTV/SplitFlapTV.xcodeproj` in Xcode.
2. Ensure `GoogleService-Info.plist` is present in the `SplitFlapTV` target (download from the Firebase console for the `co.dgrlabs.flipflap` app if missing).
3. Firebase dependencies are managed via Swift Package Manager — Xcode resolves them automatically on first build.
4. Select a tvOS 17+ simulator or Apple TV device and Build & Run (⌘R).

## Architecture notes

- **Animation coordinator**: a single `Task` advances all tiles one step per ~50ms tick, with one batched `currentBoard` state update per tick. Per-tile async tasks were too slow on A8 hardware (see commit `afed3f3`).
- **Layout**: 21 columns × 8 rows (web uses 21 × 6). Both platforms share the same word-wrap + centering algorithm and 74-character `CHARSET`.
- **Connection resilience**: the app forces a fresh anonymous auth on wake and uses listener teardown/rebuild on reconnect rather than `enableNetwork`.

## Screenshots

App Store screenshots live in `../Flip Flap tvOS Screenshots/`.
