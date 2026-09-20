import SwiftUI
import FirebaseCore
import FirebaseFirestore

@main
struct FlipFlapApp: App {
    @Environment(\.scenePhase) private var scenePhase

    init() {
        // Before anything can create an audio engine; see configureAudioSession.
        FlipSoundPlayer.configureAudioSession()
        #if DEBUG
        FirebaseConfiguration.shared.setLoggerLevel(.debug)
        #endif
        FirebaseApp.configure()
        #if DEBUG
        Firestore.enableLogging(true)
        MainThreadWatchdog.shared.start()
        #endif
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .onChange(of: scenePhase) { old, new in
                    debugLog("[SCENE] phase changed: \(old) -> \(new)")
                }
        }
    }
}
