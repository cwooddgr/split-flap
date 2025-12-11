# Split-Flap TV (tvOS)

This folder is the home for a future native tvOS client for the split-flap display.

The goal is for this app to:

- Use the **same backend protocol** and Firestore document shape as the web client.
- Render a native SwiftUI split-flap board using the shared domain concepts.

See:

- `../docs/PROTOCOL.md` for the canonical protocol and domain model.
- `../shared/protocol.ts` for TypeScript interfaces that mirror the protocol.

## High-level design

- A tvOS SwiftUI app with:
  - `SplitFlapTVApp` – the app entry point.
  - `ContentView` – root view; will own the connection to `rooms/{roomId}`.
  - Future views like `BoardView` and `TileView` for rendering the board.
- A small set of Swift models equivalent to the TypeScript interfaces:
  - `BoardConfig`
  - `Message`
  - `RoomState`

These models will map directly onto the Firestore documents described in
`docs/PROTOCOL.md`.

## Suggested file structure (inside this folder)

You can use the following layout when you create the real Xcode project:

```text
tvos/
  SplitFlapTVApp.swift     # @main entry point
  ContentView.swift        # root view
  Models/
    RoomState.swift        # Swift models for protocol
  Views/
    BoardView.swift        # renders the board from text
    TileView.swift         # renders a single flap tile
```

## How to create the Xcode project

1. Open Xcode.
2. Choose **File → New → Project…**
3. Platform: **tvOS**, Template: **App**.
4. Name it something like `SplitFlapTV`.
5. For the location, point Xcode at this `tvos` folder.
6. Let Xcode generate the `.xcodeproj` and starter SwiftUI files.
7. Replace or augment the generated files with:
   - `SplitFlapTVApp.swift` (see example in this folder).
   - `ContentView.swift`.
   - Additional models/views as needed.

## Placeholder SwiftUI files

This folder also contains minimal SwiftUI files that you can drop into the
generated project:

- `SplitFlapTVApp.swift` – basic tvOS app entry.
- `ContentView.swift` – placeholder UI that explains the future plan.

These are intentionally simple and do **not** include any Firebase code yet.


