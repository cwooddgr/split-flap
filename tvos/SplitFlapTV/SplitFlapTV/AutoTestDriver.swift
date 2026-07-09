import Foundation
#if DEBUG
import FirebaseFirestore

/// Self-driving latency test, DEBUG builds only.
///
/// Reproduces the manual test protocol without a human in the loop: writes a
/// message to this display's own room exactly the way the web remote does
/// (same document shape as control.js), waits for the snapshot to publish and
/// the board to settle, then repeats through a series of idle gaps — pairs of
/// "send after N seconds idle" and "send immediately after settle". Every
/// cycle's timings, plus any main-thread stalls the watchdog saw, are written
/// as JSON to rooms/{roomId}-METRICS so they can be read remotely via the
/// Firestore REST API with no Console.app session.
@MainActor
final class AutoTestDriver {
    /// Master switch. When true the app uses `roomId` instead of a random
    /// room so the metrics doc has a known address. Off by default so DEBUG
    /// builds behave normally; flip on for self-driving latency runs.
    static let enabled = false
    static let roomId = "DBGTEST1"

    static let shared = AutoTestDriver()

    /// Deployed security rules reject IDs outside the normal room format
    /// (verified empirically: rooms/DBGTEST1-METRICS is denied, rooms/DBGTEST1
    /// works), so the metrics doc uses an 8-char A-Z0-9 id like a real room.
    private let metricsDocId = "DBGMETR1"

    /// Idle seconds before each send. 0 = fire immediately after prior settle.
    private let gaps: [Double] = [2, 0, 15, 0, 30, 0, 60, 0]

    private var started = false
    private var cycles: [[String: Any]] = []

    struct Publish {
        let text: String
        let ageMs: Int
        let hopMs: Int
        let at: Date
        /// true = latency-compensated local echo of our own write;
        /// false = server-confirmed snapshot, the delivery path that matters.
        let pending: Bool
    }

    private var publishes: [Publish] = []
    private var lastSettle: (message: String, ticks: Int, ms: Int, cancelled: Bool, at: Date)?

    private init() {
        NotificationCenter.default.addObserver(
            forName: .ffPublished, object: nil, queue: .main
        ) { [weak self] note in
            guard let info = note.userInfo else { return }
            self?.publishes.append(Publish(
                text: info["text"] as? String ?? "",
                ageMs: info["serverAgeMs"] as? Int ?? -1,
                hopMs: info["hopMs"] as? Int ?? -1,
                at: info["receivedAt"] as? Date ?? Date(),
                pending: info["pendingWrites"] as? Bool ?? false
            ))
            if let self, self.publishes.count > 100 {
                self.publishes.removeFirst(50)
            }
        }
        NotificationCenter.default.addObserver(
            forName: .ffSettled, object: nil, queue: .main
        ) { [weak self] note in
            guard let info = note.userInfo else { return }
            self?.lastSettle = (
                message: info["message"] as? String ?? "",
                ticks: info["ticks"] as? Int ?? -1,
                ms: info["ms"] as? Int ?? -1,
                cancelled: info["cancelled"] as? Bool ?? false,
                at: Date()
            )
        }
    }

    func startIfEnabled() {
        guard Self.enabled, !started else { return }
        started = true
        Task { await run() }
    }

    private func run() async {
        debugLog("[AUTOTEST] driver active, room \(Self.roomId) — settling in for 20s")
        await report(status: "starting")
        try? await Task.sleep(for: .seconds(20))

        for (i, gap) in gaps.enumerated() {
            if gap > 0 {
                debugLog("[AUTOTEST] cycle \(i): idling \(Int(gap))s before send")
                try? await Task.sleep(for: .seconds(gap))
            }
            await runCycle(index: i, gap: gap)
            await report(status: "running")
        }

        await report(status: "complete")
        debugLog("[AUTOTEST] all \(gaps.count) cycles complete — metrics in rooms/\(metricsDocId)")
    }

    private func runCycle(index: Int, gap: Double) async {
        // Distinct text per cycle so plenty of tiles flip and publish
        // matching is unambiguous.
        let text = "AUTOTEST CYCLE \(index)\nGAP \(Int(gap)) SECONDS\n\(Self.stamp())"
        var cycle: [String: Any] = ["i": index, "gapSeconds": Int(gap)]

        let writeStart = Date()
        var writeAckMs = -1

        // Same shape control.js writes: text, updatedAt, expiresAt, source.
        Firestore.firestore().collection("rooms").document(Self.roomId).setData([
            "text": text,
            "updatedAt": FieldValue.serverTimestamp(),
            "expiresAt": Timestamp(date: Date().addingTimeInterval(7 * 24 * 3600)),
            "source": "manual",
        ]) { error in
            writeAckMs = Int(Date().timeIntervalSince(writeStart) * 1000)
            if let error {
                debugLog("[AUTOTEST] write \(index) FAILED after \(writeAckMs)ms: \(error.localizedDescription)")
            } else {
                debugLog("[AUTOTEST] write \(index) acked by server in \(writeAckMs)ms")
            }
        }

        // The write echoes back instantly from the local cache
        // (pendingWrites=true) — that's what animates the board, but it says
        // nothing about delivery. The server-confirmed snapshot
        // (pendingWrites=false) travels the same watch-stream path a message
        // from the phone remote would.
        guard let server = await waitForPublish(matching: text, pending: false, timeout: 120) else {
            debugLog("[AUTOTEST] cycle \(index): TIMEOUT waiting for server-confirmed publish (120s)")
            cycle["publishTimedOut"] = true
            cycle["writeAckMs"] = writeAckMs
            cycles.append(cycle)
            return
        }
        if let echo = publishes.first(where: { $0.text == text && $0.pending }) {
            cycle["localEchoMs"] = Int(echo.at.timeIntervalSince(writeStart) * 1000)
        }
        cycle["sendToServerPublishMs"] = Int(server.at.timeIntervalSince(writeStart) * 1000)
        cycle["serverAgeMs"] = server.ageMs
        cycle["mainHopMs"] = server.hopMs

        // Wait for the board to finish animating that text.
        if let settle = await waitForSettle(matching: text, timeout: 60) {
            cycle["settleTicks"] = settle.ticks
            cycle["settleMs"] = settle.ms
            cycle["settleCancelled"] = settle.cancelled
        } else {
            debugLog("[AUTOTEST] cycle \(index): TIMEOUT waiting for settle (60s)")
            cycle["settleTimedOut"] = true
        }

        cycle["writeAckMs"] = writeAckMs
        debugLog("[AUTOTEST] cycle \(index) done: \(cycle)")
        cycles.append(cycle)
    }

    // MARK: - Event waits

    /// Poll for the matching event. If the main thread stalls, this loop
    /// stalls with it — harmless, because every event carries timestamps
    /// captured at its source.
    private func waitForPublish(
        matching text: String, pending: Bool, timeout: TimeInterval
    ) async -> Publish? {
        let deadline = Date().addingTimeInterval(timeout)
        while Date() < deadline {
            if let p = publishes.first(where: { $0.text == text && $0.pending == pending }) {
                return p
            }
            try? await Task.sleep(for: .milliseconds(100))
        }
        return nil
    }

    private func waitForSettle(
        matching text: String, timeout: TimeInterval
    ) async -> (message: String, ticks: Int, ms: Int, cancelled: Bool, at: Date)? {
        let deadline = Date().addingTimeInterval(timeout)
        while Date() < deadline {
            if let s = lastSettle, s.message == text, !s.cancelled { return s }
            try? await Task.sleep(for: .milliseconds(100))
        }
        return nil
    }

    // MARK: - Reporting

    private func report(status: String) async {
        let payload: [String: Any] = [
            "status": status,
            "updatedAtLocal": Self.stamp(),
            "cycles": cycles,
            "mainThreadStalls": MainThreadWatchdog.shared.stallLog(),
        ]
        guard let data = try? JSONSerialization.data(withJSONObject: payload, options: [.sortedKeys]),
              let json = String(data: data, encoding: .utf8)
        else { return }

        Firestore.firestore().collection("rooms").document(metricsDocId).setData([
            "text": json,
            "updatedAt": FieldValue.serverTimestamp(),
            "expiresAt": Timestamp(date: Date().addingTimeInterval(24 * 3600)),
            "source": "autotest",
        ]) { error in
            if let error {
                debugLog("[AUTOTEST] metrics write failed: \(error.localizedDescription)")
            }
        }
    }

    private static func stamp() -> String {
        let f = DateFormatter()
        f.dateFormat = "HH:mm:ss.SSS"
        return f.string(from: Date())
    }
}

extension Notification.Name {
    static let ffPublished = Notification.Name("ff.published")
    static let ffSettled = Notification.Name("ff.settled")
}
#endif
