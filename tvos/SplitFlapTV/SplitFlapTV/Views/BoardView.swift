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

    let nextIndex = (currentIndex + 1) % CHARSET.count
    return CHARSET[nextIndex]
}

/// Board view that renders a grid of split-flap tiles.
/// Uses a centralized animation coordinator instead of per-tile async tasks.
/// This dramatically improves performance by:
/// - Running a single timer instead of 126 independent async loops
/// - Batching all state updates into one array mutation per tick
/// - Eliminating invisible 3D rotation animations
struct BoardView: View {
    let config: BoardConfig
    let message: String

    /// The characters currently displayed on each tile.
    /// This is the source of truth for what's rendered.
    @State private var currentBoard: [[Character]] = []

    /// The animation tick task - advances all tiles toward their targets.
    @State private var animationTask: Task<Void, Never>?

    /// Computed target board from the message.
    private var targetBoard: [[Character]] {
        let rows = BoardLayout.layout(message: message, config: config)
        return rows.map { Array($0) }
    }

    var body: some View {
        VStack(spacing: 8) {
            ForEach(Array(currentBoard.enumerated()), id: \.offset) { rowIndex, row in
                HStack(spacing: 5) {
                    ForEach(Array(row.enumerated()), id: \.offset) { colIndex, char in
                        TileView(character: char).equatable()
                    }
                }
            }
        }
        .padding(31)
        .background(
            RoundedRectangle(cornerRadius: 26)
                .fill(Color(.sRGB, red: 0.17, green: 0.17, blue: 0.17, opacity: 1.0))
        )
        .drawingGroup()
        .onAppear {
            initializeBoard()
        }
        .onChange(of: message) { _, _ in
            startAnimation()
        }
    }

    /// Initialize the board with empty tiles on first appear.
    private func initializeBoard() {
        // Create empty board matching config dimensions
        currentBoard = (0..<config.rows).map { _ in
            Array(repeating: Character(" "), count: config.cols)
        }
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
        let target = targetBoard

        // Ensure board dimensions match
        guard currentBoard.count == target.count else { return }

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

            // Commit the new board state (single batched update)
            currentBoard = newBoard

            // Play click sound whose density matches the number of active tiles
            FlipSoundPlayer.shared.playClick(activeTiles: changedCount)

            // Wait before next tick (~60ms per step, slightly slower than web
            // to give older Apple TV hardware breathing room)
            try? await Task.sleep(nanoseconds: 60_000_000)
        }
    }
}

/// A single split-flap tile - simplified for performance on older Apple TV hardware.
/// Uses a flat background + horizontal divider instead of two gradient-clipped halves,
/// cutting per-tile view count from ~15 to ~5 and eliminating expensive
/// LinearGradient / UnevenRoundedRectangle rendering.
private struct TileView: View, Equatable {
    let character: Character

    static func == (lhs: TileView, rhs: TileView) -> Bool {
        lhs.character == rhs.character
    }

    var body: some View {
        ZStack {
            // Tile background – slight vertical gradient faked with two stacked rects
            VStack(spacing: 0) {
                Color(.sRGB, white: 0.11, opacity: 1.0)
                Color(.sRGB, white: 0.08, opacity: 1.0)
            }
            .clipShape(RoundedRectangle(cornerRadius: 5))

            // Character
            Text(String(character))
                .font(.system(size: 65, weight: .semibold, design: .monospaced))
                .foregroundColor(.white)

            // Horizontal split line
            Rectangle()
                .fill(Color(.sRGB, white: 0.02, opacity: 1.0))
                .frame(height: 2)
        }
        .frame(width: 78, height: 104)
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
