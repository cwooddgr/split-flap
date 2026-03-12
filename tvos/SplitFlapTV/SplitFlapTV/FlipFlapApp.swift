import SwiftUI
import FirebaseCore

@main
struct FlipFlapApp: App {
    init() {
        FirebaseApp.configure()
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
