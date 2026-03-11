import Foundation
import AVFoundation

/// Procedural split-flap click sound generator using AVAudioEngine.
///
/// Pre-generates several audio buffers at init time, each containing a different
/// number of overlaid clicks to simulate the sound of varying numbers of tiles
/// flipping simultaneously. At runtime, the animation loop passes the count of
/// tiles that changed and we pick the matching buffer — still just one
/// `scheduleBuffer` call per tick, so the A8 stays happy.
final class FlipSoundPlayer {
    static let shared = FlipSoundPlayer()

    private let engine = AVAudioEngine()
    private let player = AVAudioPlayerNode()
    private var outputFormat: AVAudioFormat?
    private var lastPlayTime: TimeInterval = 0

    // Pre-generated buffers for different tile-count tiers.
    private var singleBuffer: AVAudioPCMBuffer?   // 1 tile
    private var fewBuffer: AVAudioPCMBuffer?       // 2–10 tiles
    private var manyBuffer: AVAudioPCMBuffer?      // 11–50 tiles
    private var crowdBuffer: AVAudioPCMBuffer?     // 51+ tiles

    private init() {
        setupEngine()
        createBuffers()
    }

    private func setupEngine() {
        let mainMixer = engine.mainMixerNode
        engine.attach(player)
        let format = mainMixer.outputFormat(forBus: 0)
        engine.connect(player, to: mainMixer, format: format)
        outputFormat = format

        do {
            try engine.start()
        } catch {
            print("FlipSoundPlayer: failed to start AVAudioEngine: \(error)")
        }
    }

    // MARK: - Buffer generation

    /// A single mechanical clack: noise burst (the snap) + low-freq thump
    /// (the mechanism body resonating). Varying offset/decay/pitch across
    /// overlaid clacks simulates many independent physical flaps.
    private struct Clack {
        let offset: Double      // seconds from buffer start
        let amplitude: Float    // overall volume 0…1
        let noiseDecay: Double  // noise burst envelope (shorter = sharper snap)
        let thumpFreq: Double   // low resonance frequency Hz
        let thumpDecay: Double  // resonance ring-out time
    }

    private func createBuffers() {
        guard let format = outputFormat else { return }
        let sampleRate = format.sampleRate
        let channels = Int(format.channelCount)
        // Buffer length — generous to allow wide time spread for crowd tier.
        let bufferDuration: Double = 0.08 // 80 ms
        let frameCount = Int(sampleRate * bufferDuration)

        // 1 tile — single sharp clack
        singleBuffer = makeBuffer(format: format, frameCount: frameCount,
                                  channels: channels, sampleRate: sampleRate, clacks: [
            Clack(offset: 0.000, amplitude: 0.50, noiseDecay: 0.002, thumpFreq: 300, thumpDecay: 0.006),
        ])

        // 2–10 tiles — a few clacks staggered in time
        fewBuffer = makeBuffer(format: format, frameCount: frameCount,
                               channels: channels, sampleRate: sampleRate, clacks: [
            Clack(offset: 0.000, amplitude: 0.40, noiseDecay: 0.002, thumpFreq: 280, thumpDecay: 0.006),
            Clack(offset: 0.009, amplitude: 0.35, noiseDecay: 0.0018, thumpFreq: 350, thumpDecay: 0.005),
            Clack(offset: 0.020, amplitude: 0.30, noiseDecay: 0.002, thumpFreq: 260, thumpDecay: 0.006),
            Clack(offset: 0.032, amplitude: 0.25, noiseDecay: 0.0022, thumpFreq: 320, thumpDecay: 0.005),
        ])

        // 11–50 tiles — busy mechanical rattling
        manyBuffer = makeBuffer(format: format, frameCount: frameCount,
                                channels: channels, sampleRate: sampleRate, clacks: [
            Clack(offset: 0.000, amplitude: 0.35, noiseDecay: 0.0025, thumpFreq: 250, thumpDecay: 0.007),
            Clack(offset: 0.003, amplitude: 0.30, noiseDecay: 0.0018, thumpFreq: 380, thumpDecay: 0.005),
            Clack(offset: 0.007, amplitude: 0.35, noiseDecay: 0.002, thumpFreq: 270, thumpDecay: 0.006),
            Clack(offset: 0.012, amplitude: 0.28, noiseDecay: 0.0015, thumpFreq: 400, thumpDecay: 0.005),
            Clack(offset: 0.018, amplitude: 0.32, noiseDecay: 0.002, thumpFreq: 240, thumpDecay: 0.007),
            Clack(offset: 0.024, amplitude: 0.28, noiseDecay: 0.0018, thumpFreq: 360, thumpDecay: 0.005),
            Clack(offset: 0.032, amplitude: 0.30, noiseDecay: 0.002, thumpFreq: 300, thumpDecay: 0.006),
            Clack(offset: 0.040, amplitude: 0.25, noiseDecay: 0.0022, thumpFreq: 340, thumpDecay: 0.005),
        ])

        // 51+ tiles — full mechanical cacophony
        crowdBuffer = makeBuffer(format: format, frameCount: frameCount,
                                 channels: channels, sampleRate: sampleRate, clacks: [
            Clack(offset: 0.000, amplitude: 0.32, noiseDecay: 0.003, thumpFreq: 230, thumpDecay: 0.008),
            Clack(offset: 0.002, amplitude: 0.28, noiseDecay: 0.002, thumpFreq: 400, thumpDecay: 0.005),
            Clack(offset: 0.005, amplitude: 0.32, noiseDecay: 0.0025, thumpFreq: 260, thumpDecay: 0.007),
            Clack(offset: 0.008, amplitude: 0.26, noiseDecay: 0.0018, thumpFreq: 420, thumpDecay: 0.005),
            Clack(offset: 0.011, amplitude: 0.30, noiseDecay: 0.003, thumpFreq: 240, thumpDecay: 0.007),
            Clack(offset: 0.015, amplitude: 0.26, noiseDecay: 0.002, thumpFreq: 370, thumpDecay: 0.005),
            Clack(offset: 0.019, amplitude: 0.32, noiseDecay: 0.0025, thumpFreq: 280, thumpDecay: 0.007),
            Clack(offset: 0.023, amplitude: 0.26, noiseDecay: 0.0018, thumpFreq: 390, thumpDecay: 0.005),
            Clack(offset: 0.028, amplitude: 0.30, noiseDecay: 0.002, thumpFreq: 250, thumpDecay: 0.007),
            Clack(offset: 0.033, amplitude: 0.24, noiseDecay: 0.0022, thumpFreq: 360, thumpDecay: 0.005),
            Clack(offset: 0.039, amplitude: 0.28, noiseDecay: 0.0025, thumpFreq: 290, thumpDecay: 0.006),
            Clack(offset: 0.045, amplitude: 0.22, noiseDecay: 0.002, thumpFreq: 410, thumpDecay: 0.005),
            Clack(offset: 0.052, amplitude: 0.26, noiseDecay: 0.003, thumpFreq: 270, thumpDecay: 0.006),
        ])
    }

    /// Build a PCM buffer by overlaying multiple mechanical clacks.
    /// Each clack is: a sharp noise burst (the snap of the flap) mixed with
    /// a low-frequency damped sine (the body/mechanism thump).
    private func makeBuffer(
        format: AVAudioFormat,
        frameCount: Int,
        channels: Int,
        sampleRate: Double,
        clacks: [Clack]
    ) -> AVAudioPCMBuffer? {
        guard let buffer = AVAudioPCMBuffer(
            pcmFormat: format,
            frameCapacity: AVAudioFrameCount(frameCount)
        ) else { return nil }

        buffer.frameLength = AVAudioFrameCount(frameCount)
        guard let channelData = buffer.floatChannelData else { return nil }

        // Zero out all channels
        for ch in 0..<channels {
            memset(channelData[ch], 0, frameCount * MemoryLayout<Float>.size)
        }

        // Each clack lasts ~25 ms (noise dies fast, thump rings a bit longer)
        let clackSamples = Int(sampleRate * 0.025)

        for clack in clacks {
            let startFrame = Int(clack.offset * sampleRate)
            for i in 0..<clackSamples {
                let idx = startFrame + i
                guard idx < frameCount else { break }
                let t = Double(i) / sampleRate

                // Noise burst — broadband snap of the flap hitting the stop
                let noise = Float.random(in: -1...1) * Float(exp(-t / clack.noiseDecay))

                // Low-freq thump — mechanism body resonance
                let thump = Float(sin(2.0 * .pi * clack.thumpFreq * t) * exp(-t / clack.thumpDecay))

                // Mix: noise-dominant for that mechanical character
                let sample = (noise * 0.65 + thump * 0.35) * clack.amplitude

                for ch in 0..<channels {
                    channelData[ch][idx] += sample
                }
            }
        }

        return buffer
    }

    // MARK: - Playback

    /// Play a click whose density matches the number of actively flipping tiles.
    func playClick(activeTiles: Int = 1) {
        if activeTiles == 0 { return }

        let buf: AVAudioPCMBuffer?
        switch activeTiles {
        case 1:      buf = singleBuffer
        case 2...10: buf = fewBuffer
        case 11...50: buf = manyBuffer
        default:      buf = crowdBuffer
        }

        guard let buf else { return }

        // Throttle: at most one buffer per 50 ms
        let now = CACurrentMediaTime()
        if now - lastPlayTime < 0.05 { return }
        lastPlayTime = now

        player.scheduleBuffer(buf, at: nil, options: .interrupts, completionHandler: nil)
        if !player.isPlaying {
            player.play()
        }
    }
}
