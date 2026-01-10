import SwiftUI

/// Character set matching the web app's CHARSET
private let CHARSET: [Character] = Array(
    " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.:!?-,;'\"()/@#$%&*+=<>[]{}|~\u{2018}\u{2019}\u{201C}\u{201D}°–—…"
)

/// Advance a character one step through CHARSET toward the target.
/// Returns the next character, or nil if already at target.
private func advanceChar(_ current: Character, toward target: Character) -> Character? {
    guard current != target else { return nil }

    guard let currentIndex = CHARSET.firstIndex(of: current) else {
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
        VStack(spacing: 6) {
            ForEach(Array(currentBoard.enumerated()), id: \.offset) { rowIndex, row in
                HStack(spacing: 4) {
                    ForEach(Array(row.enumerated()), id: \.offset) { colIndex, char in
                        TileView(character: char)
                    }
                }
            }
        }
        .padding(24)
        .background(
            RoundedRectangle(cornerRadius: 20)
                .fill(Color(.sRGB, red: 0.17, green: 0.17, blue: 0.17, opacity: 1.0))
        )
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
            var anyChanged = false
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
                        anyChanged = true
                    }
                }
            }

            // If nothing changed, we're done
            if !anyChanged {
                break
            }

            // Commit the new board state (single batched update)
            currentBoard = newBoard

            // Play one click sound per tick
            FlipSoundPlayer.shared.playClick()

            // Wait before next tick (~50ms per step, matching web app feel)
            try? await Task.sleep(nanoseconds: 50_000_000)
        }
    }
}

/// A single split-flap tile - purely presentational, no animation logic.
private struct TileView: View {
    let character: Character

    var body: some View {
        ZStack {
            // Background
            RoundedRectangle(cornerRadius: 4)
                .fill(Color(.sRGB, white: 0.08, opacity: 1.0))
                .overlay(
                    RoundedRectangle(cornerRadius: 4)
                        .stroke(Color.black, lineWidth: 1)
                )

            // Top half
            VStack(spacing: 0) {
                HalfTileView(character: character, half: .top)
                Spacer()
            }

            // Bottom half
            VStack(spacing: 0) {
                Spacer()
                HalfTileView(character: character, half: .bottom)
            }
        }
        .frame(width: 60, height: 80)
    }
}

/// Half of a split-flap tile (top or bottom)
private struct HalfTileView: View {
    let character: Character
    let half: Half

    enum Half {
        case top, bottom
    }

    var body: some View {
        ZStack {
            // Background gradient
            LinearGradient(
                gradient: Gradient(colors: half == .top ? [
                    Color(.sRGB, white: 0.12, opacity: 1.0),
                    Color(.sRGB, white: 0.10, opacity: 1.0)
                ] : [
                    Color(.sRGB, white: 0.10, opacity: 1.0),
                    Color(.sRGB, white: 0.06, opacity: 1.0)
                ]),
                startPoint: .top,
                endPoint: .bottom
            )

            // Text (positioned to show correct half)
            Text(String(character))
                .font(.system(size: 50, weight: .semibold, design: .monospaced))
                .foregroundColor(.white)
                .frame(width: 60, height: 80)
                .offset(y: half == .top ? 20 : -20)
        }
        .frame(width: 60, height: 40)
        .clipShape(
            half == .top ?
            UnevenRoundedRectangle(topLeadingRadius: 4, topTrailingRadius: 4) :
            UnevenRoundedRectangle(bottomLeadingRadius: 4, bottomTrailingRadius: 4)
        )
        .overlay(
            half == .top ?
            UnevenRoundedRectangle(topLeadingRadius: 4, topTrailingRadius: 4)
                .stroke(Color.black, lineWidth: 1) :
            UnevenRoundedRectangle(bottomLeadingRadius: 4, bottomTrailingRadius: 4)
                .stroke(Color.black, lineWidth: 1)
        )
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
