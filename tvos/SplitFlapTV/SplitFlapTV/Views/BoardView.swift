import SwiftUI

/// Character set matching the web app's CHARSET
private let CHARSET: [Character] = Array(
    " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.:!?-,;'\"()/@#$%&*+=<>[]{}|~\u{2018}\u{2019}\u{201C}\u{201D}°–—…"
)

/// O(1) lookup table for character → index in CHARSET.
private let CHARSET_INDEX: [Character: Int] = {
    var dict = [Character: Int](minimumCapacity: CHARSET.count)
    for (i, c) in CHARSET.enumerated() {
        dict[c] = i
    }
    return dict
}()

/// Advance a character one step through CHARSET toward the target.
/// Returns the next character, or nil if already at target.
private func advanceChar(_ current: Character, toward target: Character) -> Character? {
    guard current != target else { return nil }

    guard let currentIndex = CHARSET_INDEX[current] else {
        // Unknown character, snap to target
        return target
    }

    // Unreachable target (not in CHARSET): snap rather than cycle forever.
    // Targets are sanitized in targetBoard, so this is a safety net.
    guard CHARSET_INDEX[target] != nil else {
        return target
    }

    let nextIndex = (currentIndex + 1) % CHARSET.count
    return CHARSET[nextIndex]
}

/// Board geometry — matches the metrics of the previous SwiftUI tile grid
/// so the board's on-screen size is unchanged.
private enum Metrics {
    static let tileWidth: CGFloat = 78
    static let tileHeight: CGFloat = 104
    static let hSpacing: CGFloat = 5
    static let vSpacing: CGFloat = 8
    static let cornerRadius: CGFloat = 5
    static let fontSize: CGFloat = 65

    static func boardSize(for config: BoardConfig) -> CGSize {
        CGSize(
            width: CGFloat(config.cols) * tileWidth + CGFloat(config.cols - 1) * hSpacing,
            height: CGFloat(config.rows) * tileHeight + CGFloat(config.rows - 1) * vSpacing
        )
    }
}

/// Board view that renders a grid of split-flap tiles.
///
/// The animation coordinator (single Task, one tick per `tickInterval`)
/// advances every tile one CHARSET step per tick, exactly as before. What's
/// new is how a step is *drawn*: the whole board renders in a single Canvas
/// inside a TimelineView, and each changed tile animates a mechanical flap
/// between its previous and current character — the two-half illusion:
/// the new character's top half is revealed as a flap carrying the old top
/// half falls (vertical scale 1→0 hinged at the split line), then continues
/// down as the new bottom half (scale 0→1). No 3D transforms, one draw pass
/// for the entire board, and the TimelineView is paused whenever no flip is
/// in flight so an idle board costs nothing.
struct BoardView: View {
    let config: BoardConfig
    let message: String

    /// Characters the board is logically showing now (flip destinations).
    @State private var currentBoard: [[Character]] = []

    /// Characters shown before the last tick (flip origins).
    @State private var previousBoard: [[Character]] = []

    /// When the last tick committed — flip progress is measured from here.
    @State private var tickDate: Date = .distantPast

    /// True while any flip animation may be in flight; gates the TimelineView.
    @State private var isFlipping = false

    /// The animation tick task - advances all tiles toward their targets.
    @State private var animationTask: Task<Void, Never>?

    /// Seconds between coordinator ticks.
    private static let tickInterval: TimeInterval = 0.06

    /// Duration of one tile's flap animation. Stagger + duration stays within
    /// a tick so a flap completes before the next tick replaces its origin.
    private static let flipDuration: TimeInterval = 0.04

    /// Max per-tile start delay within a tick, so tiles don't move in lockstep.
    private static let maxStagger: TimeInterval = 0.018

    /// Computed target board from the message. Characters the board has no
    /// flap for become spaces (matching the web display in splitflap.js) —
    /// an out-of-CHARSET target would otherwise make its tile cycle forever.
    private var targetBoard: [[Character]] {
        let rows = BoardLayout.layout(message: message, config: config)
        return rows.map { row in
            row.map { CHARSET_INDEX[$0] != nil ? $0 : " " }
        }
    }

    var body: some View {
        TimelineView(.animation(paused: !isFlipping)) { timeline in
            Canvas { context, _ in
                drawBoard(in: &context, now: timeline.date)
            }
            .frame(
                width: Metrics.boardSize(for: config).width,
                height: Metrics.boardSize(for: config).height
            )
        }
        .padding(31)
        .background(
            RoundedRectangle(cornerRadius: 26)
                .fill(Color(.sRGB, red: 0.17, green: 0.17, blue: 0.17, opacity: 1.0))
        )
        .onAppear {
            initializeBoard()
        }
        .onChange(of: message) { _, newValue in
            debugLog("[BOARD] onChange fired: \"\(newValue.prefix(40))\"")
            startAnimation()
        }
    }

    // MARK: - Drawing

    /// Deterministic per-tile flip start delay (fraction of maxStagger),
    /// so neighbors flip a few ms apart instead of in unison.
    private static func stagger(row: Int, col: Int) -> TimeInterval {
        let hash = (row &* 7919 &+ col &* 104_729) % 977
        return Double(hash) / 977.0 * maxStagger
    }

    private func drawBoard(in context: inout GraphicsContext, now: Date) {
        guard !currentBoard.isEmpty else { return }

        let elapsed = now.timeIntervalSince(tickDate)

        // Resolve each distinct glyph once per frame, draw many times.
        var glyphCache: [Character: GraphicsContext.ResolvedText] = [:]
        func glyph(_ char: Character) -> GraphicsContext.ResolvedText {
            if let cached = glyphCache[char] { return cached }
            let resolved = context.resolve(
                Text(String(char))
                    .font(.system(size: Metrics.fontSize, weight: .semibold, design: .monospaced))
                    .foregroundColor(.white)
            )
            glyphCache[char] = resolved
            return resolved
        }

        for row in 0..<currentBoard.count {
            for col in 0..<currentBoard[row].count {
                let rect = CGRect(
                    x: CGFloat(col) * (Metrics.tileWidth + Metrics.hSpacing),
                    y: CGFloat(row) * (Metrics.tileHeight + Metrics.vSpacing),
                    width: Metrics.tileWidth,
                    height: Metrics.tileHeight
                )

                let current = currentBoard[row][col]
                let previous = row < previousBoard.count && col < previousBoard[row].count
                    ? previousBoard[row][col] : current

                var progress = 1.0
                if previous != current {
                    let start = Self.stagger(row: row, col: col)
                    progress = min(max((elapsed - start) / Self.flipDuration, 0), 1)
                }

                if progress >= 1 {
                    drawStaticTile(in: &context, rect: rect, glyph: glyph(current))
                } else {
                    drawFlippingTile(
                        in: &context, rect: rect,
                        oldGlyph: glyph(previous), newGlyph: glyph(current),
                        progress: progress
                    )
                }
            }
        }
    }

    /// Tile at rest: background halves, character, split line.
    private func drawStaticTile(
        in context: inout GraphicsContext,
        rect: CGRect,
        glyph: GraphicsContext.ResolvedText
    ) {
        context.drawLayer { layer in
            layer.clip(to: Path(roundedRect: rect, cornerRadius: Metrics.cornerRadius))
            fillHalves(in: &layer, rect: rect)
            layer.draw(glyph, at: CGPoint(x: rect.midX, y: rect.midY))
            drawSplitLine(in: &layer, rect: rect)
        }
    }

    /// Tile mid-flip: new top half revealed behind a falling flap that carries
    /// the old top half down (scale 1→0), then the new bottom half onward
    /// (scale 0→1) to cover the old bottom half. Gravity easing (p²) so the
    /// flap accelerates into the clack.
    private func drawFlippingTile(
        in context: inout GraphicsContext,
        rect: CGRect,
        oldGlyph: GraphicsContext.ResolvedText,
        newGlyph: GraphicsContext.ResolvedText,
        progress: Double
    ) {
        let eased = progress * progress
        let center = CGPoint(x: rect.midX, y: rect.midY)
        let topRect = CGRect(x: rect.minX, y: rect.minY, width: rect.width, height: rect.height / 2)
        let bottomRect = CGRect(x: rect.minX, y: rect.midY, width: rect.width, height: rect.height / 2)

        context.drawLayer { layer in
            layer.clip(to: Path(roundedRect: rect, cornerRadius: Metrics.cornerRadius))

            // Static layers behind the flap: new character's top half,
            // old character's bottom half.
            fillHalves(in: &layer, rect: rect)
            layer.drawLayer { top in
                top.clip(to: Path(topRect))
                top.draw(newGlyph, at: center)
            }
            layer.drawLayer { bottom in
                bottom.clip(to: Path(bottomRect))
                bottom.draw(oldGlyph, at: center)
            }

            // The moving flap, hinged at the split line.
            if eased < 0.5 {
                // First half: old top half falling toward the viewer.
                let scale = 1 - eased * 2
                layer.drawLayer { flap in
                    flap.translateBy(x: 0, y: rect.midY)
                    flap.scaleBy(x: 1, y: scale)
                    flap.translateBy(x: 0, y: -rect.midY)
                    flap.clip(to: Path(topRect))
                    flap.fill(Path(topRect), with: .color(Color(.sRGB, white: 0.11, opacity: 1.0)))
                    flap.draw(oldGlyph, at: center)
                    // Darken as the flap tilts toward edge-on.
                    flap.fill(Path(topRect), with: .color(.black.opacity(0.5 * eased * 2)))
                }
            } else {
                // Second half: new bottom half swinging down into place.
                let scale = eased * 2 - 1
                layer.drawLayer { flap in
                    flap.translateBy(x: 0, y: rect.midY)
                    flap.scaleBy(x: 1, y: scale)
                    flap.translateBy(x: 0, y: -rect.midY)
                    flap.clip(to: Path(bottomRect))
                    flap.fill(Path(bottomRect), with: .color(Color(.sRGB, white: 0.08, opacity: 1.0)))
                    flap.draw(newGlyph, at: center)
                    // Brighten from edge-on to fully lit.
                    flap.fill(Path(bottomRect), with: .color(.black.opacity(0.5 * (1 - scale))))
                }
            }

            drawSplitLine(in: &layer, rect: rect)
        }
    }

    /// Tile background: slightly lighter top half over darker bottom half.
    private func fillHalves(in layer: inout GraphicsContext, rect: CGRect) {
        layer.fill(
            Path(CGRect(x: rect.minX, y: rect.minY, width: rect.width, height: rect.height / 2)),
            with: .color(Color(.sRGB, white: 0.11, opacity: 1.0))
        )
        layer.fill(
            Path(CGRect(x: rect.minX, y: rect.midY, width: rect.width, height: rect.height / 2)),
            with: .color(Color(.sRGB, white: 0.08, opacity: 1.0))
        )
    }

    private func drawSplitLine(in layer: inout GraphicsContext, rect: CGRect) {
        layer.fill(
            Path(CGRect(x: rect.minX, y: rect.midY - 1, width: rect.width, height: 2)),
            with: .color(Color(.sRGB, white: 0.02, opacity: 1.0))
        )
    }

    // MARK: - Animation coordinator

    /// Initialize the board with empty tiles on first appear.
    private func initializeBoard() {
        // Create empty board matching config dimensions
        currentBoard = (0..<config.rows).map { _ in
            Array(repeating: Character(" "), count: config.cols)
        }
        previousBoard = currentBoard
        // Start animating toward the initial message
        startAnimation()
    }

    /// Start (or restart) the animation loop toward the current target.
    private func startAnimation() {
        // Cancel any existing animation
        animationTask?.cancel()

        animationTask = Task { @MainActor in
            await runAnimationLoop()
        }
    }

    /// Main animation loop - ticks all tiles toward their targets.
    @MainActor
    private func runAnimationLoop() async {
        let loopStart = Date()
        let target = targetBoard

        // Ensure board dimensions match
        guard currentBoard.count == target.count else {
            debugLog("[ANIM] ABORT: board \(currentBoard.count) rows vs target \(target.count) — update dropped!")
            return
        }

        debugLog("[ANIM] loop starting for \"\(message.prefix(40))\"")
        isFlipping = true
        var tickCount = 0

        while !Task.isCancelled {
            var changedCount = 0
            var newBoard = currentBoard

            // Advance each tile one step toward its target
            for row in 0..<newBoard.count {
                guard row < target.count else { continue }
                for col in 0..<newBoard[row].count {
                    guard col < target[row].count else { continue }

                    let current = newBoard[row][col]
                    let targetChar = target[row][col]

                    if let next = advanceChar(current, toward: targetChar) {
                        newBoard[row][col] = next
                        changedCount += 1
                    }
                }
            }

            // If nothing changed, we're done
            if changedCount == 0 {
                break
            }

            // Commit the new board state (single batched update). The Canvas
            // animates each changed tile from previousBoard to currentBoard.
            previousBoard = currentBoard
            currentBoard = newBoard
            tickDate = Date()

            tickCount += 1
            if tickCount == 1 {
                debugLog("[ANIM] first tick committed (\(debugMs(from: loopStart)) after loop start, \(changedCount) tiles)")
            }

            // Play clacks whose density matches the number of active tiles
            FlipSoundPlayer.shared.playClick(activeTiles: changedCount)

            try? await Task.sleep(nanoseconds: UInt64(Self.tickInterval * 1_000_000_000))
        }

        debugLog("[ANIM] loop \(Task.isCancelled ? "cancelled" : "settled") after \(tickCount) ticks in \(debugMs(from: loopStart))")

        // Let the last flaps land, then pause the TimelineView.
        try? await Task.sleep(
            nanoseconds: UInt64((Self.maxStagger + Self.flipDuration) * 1_000_000_000)
        )
        if !Task.isCancelled {
            isFlipping = false
            debugLog("[ANIM] isFlipping=false — TimelineView paused")
        }
    }
}

struct BoardView_Previews: PreviewProvider {
    static var previews: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            BoardView(
                config: BoardConfig(cols: 10, rows: 3),
                message: "HELLO\nTVOS"
            )
        }
        .previewLayout(.sizeThatFits)
    }
}
