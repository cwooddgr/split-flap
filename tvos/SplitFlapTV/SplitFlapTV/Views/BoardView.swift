import SwiftUI

/// Character set matching the web app's CHARSET
private let CHARSET: [Character] = Array(
    " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.:!?-,;'\"()/@#$%&*+=<>[]{}|~‘’“”°–—…"
)

/// Board view that renders a grid of tiles from a message string.
/// Uses BoardLayout to mirror the JavaScript implementation in splitflap.js
/// (wrapping at word boundaries and centering the block of text).
struct BoardView: View {
    let config: BoardConfig
    let message: String

    private var rows: [String] {
        BoardLayout.layout(message: message, config: config)
    }

    var body: some View {
        VStack(spacing: 6) {
            ForEach(Array(rows.enumerated()), id: \.offset) { _, line in
                HStack(spacing: 4) {
                    ForEach(Array(line.enumerated()), id: \.offset) { _, char in
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
    }
}

private struct TileView: View {
    let character: Character
    
    @State private var displayChar: Character = " "
    @State private var flipChar: Character = " "
    @State private var isFlipping: Bool = false
    @State private var flipRotation: Double = 0
    @State private var animationTask: Task<Void, Never>?
    @State private var animationId: Int = 0

    var body: some View {
        GeometryReader { geometry in
            ZStack {
                // Background
                RoundedRectangle(cornerRadius: 4)
                    .fill(Color(.sRGB, white: 0.08, opacity: 1.0))
                    .overlay(
                        RoundedRectangle(cornerRadius: 4)
                            .stroke(Color.black, lineWidth: 1)
                    )
                
                // Static top half
                VStack(spacing: 0) {
                    HalfTileView(character: displayChar, half: .top)
                    Spacer()
                }
                
                // Static bottom half
                VStack(spacing: 0) {
                    Spacer()
                    HalfTileView(character: displayChar, half: .bottom)
                }
                
                // Flipping top half (animated)
                if isFlipping {
                    VStack(spacing: 0) {
                        HalfTileView(character: flipChar, half: .top)
                        Spacer()
                    }
                    .rotation3DEffect(
                        .degrees(flipRotation),
                        axis: (x: 1, y: 0, z: 0),
                        anchor: .bottom,
                        perspective: 0.3
                    )
                    .opacity(flipRotation < -160 ? 0 : 1)
                }
            }
        }
        .frame(width: 60, height: 80)
        .onChange(of: character) { _, newChar in
            if newChar != displayChar {
                startAnimation(to: newChar)
            }
        }
        .onAppear {
            displayChar = character
            flipChar = character
        }
    }
    
    private func startAnimation(to targetChar: Character) {
        // Cancel any existing animation task and bump the animation id so
        // any in-flight sequences know they are obsolete.
        animationTask?.cancel()
        animationId &+= 1
        let currentId = animationId

        animationTask = Task { @MainActor in
            await animateSequence(to: targetChar, animationId: currentId)
        }
    }
    
    @MainActor
    private func animateSequence(to targetChar: Character, animationId: Int) async {
        // If a newer animation has started, abort immediately.
        guard animationId == self.animationId else { return }

        guard let targetIndex = CHARSET.firstIndex(of: targetChar) else {
            displayChar = targetChar
            return
        }

        guard var currentIndex = CHARSET.firstIndex(of: displayChar) else {
            displayChar = targetChar
            return
        }

        var steps = targetIndex - currentIndex
        if steps < 0 { steps += CHARSET.count }
        if steps == 0 { return }

        for _ in 0..<steps {
            // Check again at the start of each step for newer animations.
            guard animationId == self.animationId else { return }

            if Task.isCancelled { return }

            let nextIndex = (currentIndex + 1) % CHARSET.count
            let nextChar = CHARSET[nextIndex]

            // Begin flip: show current char on the flipping half
            flipChar = CHARSET[currentIndex]
            isFlipping = true
            flipRotation = 0

            // Play a (throttled) click sound for this flip step.
            FlipSoundPlayer.shared.playClick()

            // Flip animation duration shortened to 25ms to keep overall
            // per-step timing around 50ms.
            withAnimation(.easeInOut(duration: 0.025)) {
                flipRotation = -180
            }

            // Wait briefly for the flip to finish (~25ms)
            try? await Task.sleep(nanoseconds: 25_000_000)

            if Task.isCancelled { return }
            guard animationId == self.animationId else { return }

            // Commit to the next character and reset the flip
            displayChar = nextChar
            isFlipping = false
            flipRotation = 0

            // Brief pause before the next flip (~25ms) so overall step timing
            // is about 50ms instead of the previous 100ms.
            try? await Task.sleep(nanoseconds: 25_000_000)

            currentIndex = nextIndex
        }
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


