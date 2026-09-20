import SwiftUI
import FirebaseCore
import FirebaseFirestore
#if DEBUG
import AVFoundation
#endif

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
        // Music-stops bug: was other audio still playing before we touched audio at all?
        debugLog("[AUDIO] at app init: otherAudioPlaying=\(AVAudioSession.sharedInstance().isOtherAudioPlaying) category=\(AVAudioSession.sharedInstance().category.rawValue)")
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
