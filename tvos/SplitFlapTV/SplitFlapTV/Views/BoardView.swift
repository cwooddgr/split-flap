import SwiftUI

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

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 4)
                .fill(
                    LinearGradient(
                        gradient: Gradient(colors: [
                            Color(.sRGB, white: 0.12, opacity: 1.0),
                            Color(.sRGB, white: 0.05, opacity: 1.0)
                        ]),
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 4)
                        .stroke(Color.black, lineWidth: 1)
                )

            Text(String(character))
                .font(.system(size: 32, weight: .semibold, design: .monospaced))
                .foregroundColor(.white)
        }
        .frame(width: 60, height: 80)
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


