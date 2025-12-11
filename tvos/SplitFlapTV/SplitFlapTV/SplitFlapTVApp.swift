import SwiftUI
import FirebaseCore

@main
struct SplitFlapTVApp: App {
    init() {
        FirebaseApp.configure()
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
