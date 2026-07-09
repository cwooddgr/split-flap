import SwiftUI
import FirebaseCore
import FirebaseFirestore

@main
struct FlipFlapApp: App {
    init() {
        #if DEBUG
        FirebaseConfiguration.shared.setLoggerLevel(.debug)
        #endif
        FirebaseApp.configure()
        #if DEBUG
        Firestore.enableLogging(true)
        #endif
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
