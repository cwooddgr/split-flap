import Foundation
import AVFoundation

/// Simple procedural click sound generator using AVAudioEngine.
/// This mirrors the idea of the web implementation, which plays a short
/// burst of decaying noise for each flap flip.
final class FlipSoundPlayer {
    static let shared = FlipSoundPlayer()

    private let engine = AVAudioEngine()
    private let player = AVAudioPlayerNode()
    private var buffer: AVAudioPCMBuffer?
    private var outputFormat: AVAudioFormat?
    private var lastPlayTime: TimeInterval = 0

    private init() {
        setupEngine()
        createClickBuffer()
    }

    private func setupEngine() {
        let mainMixer = engine.mainMixerNode
        engine.attach(player)
        // Use the mixer’s output format so our buffer matches its channel count
        let format = mainMixer.outputFormat(forBus: 0)
        engine.connect(player, to: mainMixer, format: format)
        outputFormat = format

        do {
            try engine.start()
        } catch {
            print("FlipSoundPlayer: failed to start AVAudioEngine: \(error)")
        }
    }

    private func createClickBuffer() {
        // Use the engine / mixer format so channel count and sample rate match
        guard let format = outputFormat else { return }

        let sampleRate = format.sampleRate
        let duration: Double = 0.03 // 30 ms
        let frameCount = AVAudioFrameCount(sampleRate * duration)

        guard let buffer = AVAudioPCMBuffer(
            pcmFormat: format,
            frameCapacity: frameCount
        ) else {
            return
        }

        buffer.frameLength = frameCount
        guard let channelData = buffer.floatChannelData else { return }

        // Generate a short, clean "click": a few cycles of a decaying sine wave
        // at a fairly high frequency so it reads as a tick rather than a tone.
        let channels = Int(format.channelCount)
        let frequency: Double = 2500 // Hz

        for ch in 0..<channels {
            let channel = channelData[ch]
            for i in 0..<Int(frameCount) {
                let t = Double(i) / sampleRate
                let envelope = exp(-t / 0.003) // very fast decay (~3 ms)
                let sample = sin(2.0 * .pi * frequency * t) * envelope * 0.5
                channel[i] = Float(sample)
            }
        }

        self.buffer = buffer
    }

    func playClick() {
        guard let buffer = buffer else { return }

        // Throttle to avoid overwhelming the Apple TV with too many clicks.
        // Limit to at most one click every 20ms (~50 clicks/second).
        let now = CACurrentMediaTime()
        if now - lastPlayTime < 0.02 {
            return
        }
        lastPlayTime = now

        // Schedule a short buffer; let the player run continuously
        player.scheduleBuffer(buffer, at: nil, options: .interrupts, completionHandler: nil)

        if !player.isPlaying {
            player.play()
        }
    }
}


