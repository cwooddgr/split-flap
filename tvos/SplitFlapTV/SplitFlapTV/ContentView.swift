
import SwiftUI
import UIKit

struct ContentView: View {
    /// Random room id generated once per app launch, mirroring the web display.
    /// Uses 6–8 characters from A–Z0–9, just like `generateRoomId` in display.js.
    private static let initialRoomId: String = {
        #if DEBUG
        // Auto-test builds use a fixed room so the metrics doc has a known
        // address readable from outside the device.
        if AutoTestDriver.enabled { return AutoTestDriver.roomId }
        #endif
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

    // Board configuration for tvOS (21x8).
    // We no longer show a default message; the board starts blank until
    // Firestore delivers real data for the current room.
    private let sampleConfig = BoardConfig(cols: 21, rows: 8)

    // Room id is generated randomly once per app launch, like the web display.
    @StateObject private var viewModel = RoomViewModel(roomId: ContentView.initialRoomId)
    @State private var isQRCodeHidden = false

    /// Burn-in guard. The idle timer is off and a message can sit for days, so
    /// everything on screen drifts a few points around a small circle, one
    /// step every few minutes, slowly enough that nobody sees it move.
    @State private var shiftStep = 0
    private static let shiftRadius: CGFloat = 6
    private static let shiftSteps = 8
    private static let shiftInterval: TimeInterval = 180
    private static let shiftDuration: TimeInterval = 3

    private var burnInOffset: CGSize {
        let angle = 2 * Double.pi * Double(shiftStep % Self.shiftSteps) / Double(Self.shiftSteps)
        return CGSize(width: Self.shiftRadius * cos(angle), height: Self.shiftRadius * sin(angle))
    }

    private var effectiveText: String {
        viewModel.state?.text ?? "Scan the QR code to change this message. Press the center of the clickpad on your Apple TV remote to hide the QR code."
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

    private let backgroundColor: Color = .black

    var body: some View {
        ZStack {
            backgroundColor
                .ignoresSafeArea()

            ZStack(alignment: .bottomTrailing) {
                // Display board centered on screen.
                BoardView(
                    config: sampleConfig,
                    message: effectiveText
                )
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)

                // QR code anchored in the bottom-right corner.
                // We only show it after RoomViewModel has finished auth and
                // attached the Firestore listener (viewModel.isReady == true).
                if let controlURLString, !isQRCodeHidden, viewModel.isReady {
                    QRCodeView(text: controlURLString, size: 160)
                        .padding(60)
                }
            }
            // Connection status, bottom-left, shown only while something has
            // been wrong for a few seconds (the same line the web display shows).
            .overlay(alignment: .bottomLeading) {
                if viewModel.showsReconnecting {
                    Text("Reconnecting…")
                        .font(.system(size: 24, weight: .regular))
                        .textCase(.uppercase)
                        .kerning(1)
                        .foregroundColor(.white.opacity(0.9))
                        .padding(.horizontal, 28)
                        .padding(.vertical, 14)
                        .background(Capsule().fill(Color.black.opacity(0.7)))
                        .padding(60)
                }
            }
            .offset(burnInOffset)
        }
        .task {
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: UInt64(Self.shiftInterval * 1_000_000_000))
                if Task.isCancelled { break }
                withAnimation(.easeInOut(duration: Self.shiftDuration)) {
                    shiftStep += 1
                }
            }
        }
        // On tvOS, treat any remote tap (select press on the focused area)
        // as a toggle for the QR code visibility.
        .focusable(true)
        .contentShape(Rectangle())
        .onTapGesture {
            isQRCodeHidden.toggle()
        }
        // Keep the Apple TV from sleeping/screensaver while this view is visible.
        .onAppear {
            UIApplication.shared.isIdleTimerDisabled = true
            #if DEBUG
            AutoTestDriver.shared.startIfEnabled()
            #endif
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

