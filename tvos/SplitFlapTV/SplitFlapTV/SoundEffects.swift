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

    private init() {
        setupEngine()
        createClickBuffer()
    }

    private func setupEngine() {
        let mainMixer = engine.mainMixerNode
        engine.attach(player)
        engine.connect(player, to: mainMixer, format: nil)

        do {
            try engine.start()
        } catch {
            print("FlipSoundPlayer: failed to start AVAudioEngine: \(error)")
        }
    }

    private func createClickBuffer() {
        let sampleRate: Double = 44_100
        let duration: Double = 0.03 // 30 ms
        let frameCount = AVAudioFrameCount(sampleRate * duration)

        guard let format = AVAudioFormat(
            standardFormatWithSampleRate: sampleRate,
            channels: 1
        ) else {
            return
        }

        guard let buffer = AVAudioPCMBuffer(
            pcmFormat: format,
            frameCapacity: frameCount
        ) else {
            return
        }

        buffer.frameLength = frameCount
        guard let channelData = buffer.floatChannelData?.pointee else { return }

        // Generate decaying noise similar to the JS implementation
        for i in 0..<Int(frameCount) {
            let t = Double(i)
            let decay = exp(-t / (Double(frameCount) * 0.1))
            channelData[i] = Float.random(in: -1...1) * Float(decay) * 0.5
        }

        self.buffer = buffer
    }

    func playClick() {
        guard let buffer = buffer else { return }

        // Schedule a short buffer; let the player run continuously
        player.scheduleBuffer(buffer, at: nil, options: .interrupts, completionHandler: nil)

        if !player.isPlaying {
            player.play()
        }
    }
}


