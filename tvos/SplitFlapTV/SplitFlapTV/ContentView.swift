
import SwiftUI
import UIKit

struct ContentView: View {
    /// Random room id generated once per app launch, mirroring the web display.
    /// Uses 6–8 characters from A–Z0–9, just like `generateRoomId` in display.js.
    private static let initialRoomId: String = {
        let chars = Array("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")
        let length = 6 + Int.random(in: 0..<3) // 6–8 chars
        var id = ""
        for _ in 0..<length {
            if let ch = chars.randomElement() {
                id.append(ch)
            }
        }
        return id
    }()

    // Board configuration matches the web display (21x6).
    // We no longer show a default message; the board starts blank until
    // Firestore delivers real data for the current room.
    private let sampleConfig = BoardConfig(cols: 21, rows: 6)

    // Room id is generated randomly once per app launch, like the web display.
    @StateObject private var viewModel = RoomViewModel(roomId: ContentView.initialRoomId)
    @State private var isQRCodeHidden = false

    private var effectiveText: String {
        viewModel.state?.text ?? "Scan the QR code to change this message"
    }

    // Base URL of the deployed web app (display/remote).
    // Currently hosted at https://flipflap.dgrlabs.co/
    private let webBaseURLString = "https://flipflap.dgrlabs.co/"

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
            // We only show it after RoomViewModel has finished auth and
            // attached the Firestore listener (viewModel.isReady == true).
            if let controlURLString, !isQRCodeHidden, viewModel.isReady {
                QRCodeView(text: controlURLString, size: 160)
                    .padding(40)
            }
        }
        // On tvOS, treat any remote tap (select press on the focused area)
        // as a request to hide the QR code, mirroring the web app's tap-to-hide.
        .focusable(true)
        .contentShape(Rectangle())
        .onTapGesture {
            isQRCodeHidden = true
        }
        // Keep the Apple TV from sleeping/screensaver while this view is visible.
        .onAppear {
            UIApplication.shared.isIdleTimerDisabled = true
        }
        .onDisappear {
            UIApplication.shared.isIdleTimerDisabled = false
        }
    }
}

struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        ContentView()
    }
}

