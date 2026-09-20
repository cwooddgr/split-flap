import Foundation
import AVFoundation

/// Split-flap clack player backed by recordings of a real split-flap display.
///
/// Loads a set of short clack samples (extracted from a CC0 recording of a
/// mechanical split-flap board, Freesound #261244) at init. Each animation
/// tick, the coordinator reports how many tiles flipped and we schedule a few
/// randomly chosen samples with randomized gain and timing jitter within the
/// tick. The randomization is what keeps a 60 ms tick cadence sounding like a
/// mechanical clatter instead of a periodic hum.
final class FlipSoundPlayer {
    static let shared = FlipSoundPlayer()

    /// Length of one animation tick — clack jitter is spread across this window.
    private static let tickDuration = 0.06

    private let engine = AVAudioEngine()

    /// Pool of player nodes used round-robin so overlapping clacks can play
    /// simultaneously (a single AVAudioPlayerNode plays buffers sequentially).
    private var players: [AVAudioPlayerNode] = []
    private var nextPlayer = 0

    private var clackBuffers: [AVAudioPCMBuffer] = []

    /// DEBUG bisect switch for the "launching stops the user's music" bug:
    /// set to true and the app never touches AVAudioSession or AVAudioEngine.
    /// If music still stops with this on, the cause isn't in this file.
    /// Remove once that bug is closed.
    #if DEBUG
    private static let soundDisabledForBisect = false
    #endif

    private init() {
        #if DEBUG
        if Self.soundDisabledForBisect {
            debugLog("[AUDIO] sound disabled for bisect; session and engine never touched")
            return
        }
        #endif
        loadBuffers()
        setupEngine()
    }

    /// One line of audio-session state, for the music-stops bug.
    private func logSession(_ label: String) {
        #if DEBUG
        let session = AVAudioSession.sharedInstance()
        debugLog("[AUDIO] \(label): category=\(session.category.rawValue) options=\(session.categoryOptions.rawValue) otherAudioPlaying=\(session.isOtherAudioPlaying) engineRunning=\(engine.isRunning)")
        #endif
    }

    private func loadBuffers() {
        for i in 0..<12 {
            let name = String(format: "clack_%02d", i)
            guard let url = Bundle.main.url(forResource: name, withExtension: "caf") else {
                print("FlipSoundPlayer: missing sample \(name).caf")
                continue
            }
            do {
                let file = try AVAudioFile(forReading: url)
                guard let buffer = AVAudioPCMBuffer(
                    pcmFormat: file.processingFormat,
                    frameCapacity: AVAudioFrameCount(file.length)
                ) else { continue }
                try file.read(into: buffer)
                clackBuffers.append(buffer)
            } catch {
                print("FlipSoundPlayer: failed to load \(name).caf: \(error)")
            }
        }
    }

    private func setupEngine() {
        guard let format = clackBuffers.first?.format else {
            print("FlipSoundPlayer: no samples loaded, sound disabled")
            return
        }

        // 8 players: at most 5 clacks per tick, so a node is reused no sooner
        // than ~96 ms later — past the end of its previous 80 ms buffer.
        for _ in 0..<8 {
            let player = AVAudioPlayerNode()
            engine.attach(player)
            engine.connect(player, to: engine.mainMixerNode, format: format)
            players.append(player)
        }

        // The clacks are decoration, so mix with whatever else is playing.
        // Without this the session defaults to .soloAmbient, which is
        // nonmixable: starting the engine stopped the user's music (confirmed
        // on an Apple TV, 2026-09-20). Must be set before the engine starts,
        // because starting it is what activates the session.
        logSession("before setCategory")
        do {
            try AVAudioSession.sharedInstance().setCategory(.ambient)
        } catch {
            print("FlipSoundPlayer: failed to set audio session category: \(error)")
            debugLog("[AUDIO] setCategory(.ambient) FAILED: \(error)")
        }
        logSession("after setCategory")

        // When the output hardware's channel count or sample rate changes (a
        // route change to AirPods or a HomePod, a TV format switch) the engine
        // stops itself and posts this. Nothing else restarts it, and playClick
        // skips every clack while it's stopped, so without this the app would
        // stay silent until relaunch. The callback arrives on an internal
        // queue; hop to the main actor before touching the engine.
        NotificationCenter.default.addObserver(
            forName: .AVAudioEngineConfigurationChange, object: engine, queue: nil
        ) { [weak self] _ in
            Task { @MainActor [weak self] in self?.startEngine() }
        }

        startEngine()
    }

    private func startEngine() {
        guard !players.isEmpty, !engine.isRunning else { return }
        logSession("before engine.start")
        do {
            try engine.start()
            for player in players {
                player.play()
            }
        } catch {
            print("FlipSoundPlayer: failed to start AVAudioEngine: \(error)")
            debugLog("[AUDIO] engine.start FAILED: \(error)")
        }
        logSession("after engine.start")
    }

    // MARK: - Playback

    /// Play clacks for one animation tick with `activeTiles` tiles flipping.
    /// A real board at full tilt reads as a texture, not one sound per tile:
    /// density maps to roughly one audible clack per 6 active tiles.
    func playClick(activeTiles: Int = 1) {
        guard activeTiles > 0, !clackBuffers.isEmpty, engine.isRunning else { return }

        let raw = Double(activeTiles) / 6.0 + Double.random(in: -0.75...0.75)
        let clackCount = min(max(Int(raw.rounded()), 1), 5)

        for _ in 0..<clackCount {
            let buffer = clackBuffers.randomElement()!
            let player = players[nextPlayer]
            nextPlayer = (nextPlayer + 1) % players.count

            player.volume = Float.random(in: 0.35...0.7)

            // Land at a random point within the tick so no two ticks pulse
            // at the same phase.
            let jitter = Double.random(in: 0..<Self.tickDuration)
            var when: AVAudioTime?
            if let nodeTime = player.lastRenderTime,
               let playerTime = player.playerTime(forNodeTime: nodeTime) {
                let offset = AVAudioFramePosition(jitter * playerTime.sampleRate)
                when = AVAudioTime(
                    sampleTime: playerTime.sampleTime + offset,
                    atRate: playerTime.sampleRate
                )
            }

            player.scheduleBuffer(buffer, at: when, options: [], completionHandler: nil)
        }
    }
}
