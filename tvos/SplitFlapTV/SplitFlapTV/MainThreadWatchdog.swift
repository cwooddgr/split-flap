import Foundation

/// Detects main-thread stalls, DEBUG builds only.
///
/// A background timer enqueues a ping onto the main queue every 250 ms and
/// watches how stale the last acknowledged ping is. Standalone device captures
/// showed a `DispatchQueue.main.async` hop taking 26 s while the board sat
/// idle — this pins down exactly when the main thread stops servicing its
/// queue and for how long, independent of any message traffic.
#if DEBUG
final class MainThreadWatchdog {
    static let shared = MainThreadWatchdog()

    private let queue = DispatchQueue(label: "co.dgrlabs.flipflap.watchdog", qos: .utility)
    private let lock = NSLock()
    private var lastPong = Date()
    private var stallStart: Date?
    private var started = false

    /// Gap beyond which the main thread is considered stalled.
    private let stallThreshold: TimeInterval = 1.0

    func start() {
        queue.sync {
            guard !started else { return }
            started = true
        }
        debugLog("[WATCHDOG] main-thread watchdog started (250ms pings, 1s threshold)")

        let timer = DispatchSource.makeTimerSource(queue: queue)
        timer.schedule(deadline: .now(), repeating: .milliseconds(250))
        timer.setEventHandler { [weak self] in self?.tick() }
        timer.resume()
        // Keep the source alive for the life of the process.
        self.timer = timer
    }

    private var timer: DispatchSourceTimer?

    private func tick() {
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            self.lock.lock()
            self.lastPong = Date()
            self.lock.unlock()
        }

        lock.lock()
        let gap = Date().timeIntervalSince(lastPong)
        let inStall = stallStart
        lock.unlock()

        if gap > stallThreshold {
            if inStall == nil {
                lock.lock()
                stallStart = lastPong
                lock.unlock()
                debugLog("[WATCHDOG] MAIN THREAD STALLED — no pong for \(String(format: "%.1f", gap))s (stall began ~\(debugMs(from: lastPong)) ago)")
            }
        } else if let began = inStall {
            debugLog("[WATCHDOG] main thread recovered — stall lasted \(debugMs(from: began))")
            lock.lock()
            stallStart = nil
            lock.unlock()
        }
    }
}
#endif
