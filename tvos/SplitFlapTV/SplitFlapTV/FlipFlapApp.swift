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
        // Memory-only cache. A room is never opened again after the app quits,
        // so a disk cache only collects documents nothing will read. This has
        // to be set before anything else touches Firestore.
        let settings = FirestoreSettings()
        settings.cacheSettings = MemoryCacheSettings()
        Firestore.firestore().settings = settings
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
