
import SwiftUI

struct ContentView: View {
    // Temporary sample data; used as a fallback before Firestore data arrives.
    private let sampleConfig = BoardConfig(cols: 21, rows: 6)
    private let sampleState = RoomState(
        text: "WELCOME TO\nSPLIT-FLAP TV",
        source: "sample",
        updatedAt: nil
    )

    // TODO: Replace this with a real room id (e.g., one shown on the web display).
    @StateObject private var viewModel = RoomViewModel(roomId: "ABC123")

    private var effectiveText: String {
        viewModel.state?.text ?? sampleState.text
    }

    // Base URL of the deployed web app (display/remote).
    // Currently hosted at https://interestingtimes.blog/split-flap/
    private let webBaseURLString = "https://interestingtimes.blog/split-flap/"

    private var controlURLString: String? {
        guard let baseURL = URL(string: webBaseURLString) else { return nil }
        var components = URLComponents(
            url: baseURL.appendingPathComponent("control.html"),
            resolvingAgainstBaseURL: false
        )
        components?.queryItems = [URLQueryItem(name: "room", value: viewModel.roomId)]
        return components?.url?.absoluteString
    }

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            Color.black.ignoresSafeArea()

            // Display board centered, filling most of the screen with a border.
            BoardView(
                config: sampleConfig,
                message: effectiveText
            )
            .scaleEffect(1.3)
            .padding(.top, 40)
            .offset(y: -100)         // negative offset moves the board up
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)

            // QR code anchored in the bottom-right corner.
            if let controlURLString {
                QRCodeView(text: controlURLString, size: 80)
                    .padding(40)
            }
        }
    }
}

struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        ContentView()
    }
}

