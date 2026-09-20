import Foundation
import Combine
import FirebaseAuth
import FirebaseFirestore

/// Observable view model that mirrors the web display's Firestore behavior
/// (web/display.js):
/// - Signs in anonymously, retrying with backoff for as long as it takes.
/// - Keeps one listener on rooms/{roomId} for the life of the app. The SDK
///   reconnects it and refreshes the auth token by itself.
/// - Publishes RoomState when the document's message changes.
/// - Takes its connection state from snapshot metadata alone.
///
/// Until 1.2 this file also ran a 5-minute health check, a 55-minute token
/// refresh, and a sign-out-and-recreate "reconnect". None of it was needed (see
/// docs/AUDIT_2026-09.md), the health check could tear down a healthy listener,
/// and every forced re-auth made a new anonymous account. Never sign out to
/// "fix" a connection.
/// Debug logging lives in DebugLog.swift (timestamped, DEBUG builds only).

final class RoomViewModel: ObservableObject {
    @Published var state: RoomState?
    /// Becomes true after authentication succeeds, allowing the UI to display
    /// the QR code immediately without waiting for Firestore connectivity.
    @Published var isReady: Bool = false
    /// True once trouble has lasted `troubleDelay`, so a normal launch or a
    /// brief blip never shows the "Reconnecting" line.
    @Published var showsReconnecting: Bool = false

    let roomId: String

    // MARK: - Connection Management

    private var listener: ListenerRegistration?
    private var signInFailures = 0
    private var listenerFailures = 0
    private var troubleTimer: DispatchWorkItem?

    private static let troubleDelay: TimeInterval = 5

    /// Retry delays: 1 s, 2 s, 4 s, ... capped at a minute (as on the web).
    private static func backoff(_ attempt: Int) -> TimeInterval {
        min(60, pow(2, Double(min(attempt, 6))))
    }

    // MARK: - Initialization

    init(roomId: String) {
        self.roomId = roomId
        signIn()
    }

    deinit {
        listener?.remove()
        troubleTimer?.cancel()
    }

    // MARK: - Authentication

    /// Anonymous auth, so Firestore rules allow the read. signInAnonymously
    /// returns the persisted user when the device already has one.
    private func signIn() {
        Auth.auth().signInAnonymously { [weak self] _, error in
            DispatchQueue.main.async {
                guard let self = self else { return }
                if let error = error {
                    let delay = Self.backoff(self.signInFailures)
                    self.signInFailures += 1
                    debugLog("[AUTH] sign-in failed, retrying in \(Int(delay))s: \(error.localizedDescription)")
                    self.setTrouble(true)
                    DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
                        self?.signIn()
                    }
                    return
                }
                self.signInFailures = 0
                // The QR code only needs the roomId, not Firestore connectivity.
                self.isReady = true
                self.startListening()
            }
        }
    }

    // MARK: - Connection status

    private func setTrouble(_ trouble: Bool) {
        if !trouble {
            troubleTimer?.cancel()
            troubleTimer = nil
            if showsReconnecting {
                debugLog("[STATE] Connection restored")
                showsReconnecting = false
            }
            return
        }
        guard troubleTimer == nil, !showsReconnecting else { return }
        let timer = DispatchWorkItem { [weak self] in
            self?.troubleTimer = nil
            self?.showsReconnecting = true
        }
        troubleTimer = timer
        DispatchQueue.main.asyncAfter(deadline: .now() + Self.troubleDelay, execute: timer)
    }

    // MARK: - Firestore Listener

    private func startListening() {
        let db = Firestore.firestore()

        debugLog("[LISTENER] Setting up Firestore listener for room: \(roomId)")

        // Metadata changes are included because isFromCache is the connection
        // signal: it turns true when the SDK loses the server and false when it
        // is back, so the status always clears.
        listener = db.collection("rooms").document(roomId)
            .addSnapshotListener(includeMetadataChanges: true) { [weak self] snapshot, error in
                // Timestamp on Firestore's callback queue, BEFORE hopping to
                // main: a gap between this line and the "main hop" line below
                // means the main thread was busy, not the network.
                let receivedAt = Date()
                if let snapshot = snapshot {
                    let meta = snapshot.metadata
                    let text = (snapshot.data()?["text"] as? String) ?? "<no text>"
                    debugLog("[SNAPSHOT] received (fromCache=\(meta.isFromCache), pendingWrites=\(meta.hasPendingWrites)) text=\"\(text.prefix(40))\"")
                    if let ts = snapshot.data()?["updatedAt"] as? Timestamp {
                        debugLog("[SNAPSHOT] server updatedAt age: \(debugMs(from: ts.dateValue())) (server write -> device receipt, incl. clock skew)")
                    }
                } else if let error = error {
                    debugLog("[SNAPSHOT] received error: \(error.localizedDescription)")
                }

                DispatchQueue.main.async {
                    guard let self = self else { return }
                    let hopMs = Int(Date().timeIntervalSince(receivedAt) * 1000)
                    debugLog("[SNAPSHOT] main-thread hop took \(hopMs)ms")

                    // A listener error (rules, a revoked user) ends the
                    // listener, so resubscribe with capped backoff.
                    if let error = error {
                        let delay = Self.backoff(self.listenerFailures)
                        self.listenerFailures += 1
                        debugLog("[ERROR] Snapshot listener error, resubscribing in \(Int(delay))s: \(error.localizedDescription)")
                        self.setTrouble(true)
                        self.listener?.remove()
                        self.listener = nil
                        DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
                            self?.startListening()
                        }
                        return
                    }

                    guard let snapshot = snapshot else { return }

                    if snapshot.metadata.isFromCache {
                        self.setTrouble(true)
                    } else {
                        self.listenerFailures = 0
                        self.setTrouble(false)
                    }

                    // The room document doesn't exist until a remote first
                    // writes to it; leave state unchanged.
                    guard let data = snapshot.data(),
                          let text = data["text"] as? String
                    else { return }

                    let source = data["source"] as? String
                    let updatedAt = (data["updatedAt"] as? Timestamp)?.dateValue()

                    // A metadata-only snapshot repeats the message we already
                    // have. Don't publish it again.
                    if let current = self.state,
                       current.text == text, current.source == source, current.updatedAt == updatedAt {
                        return
                    }

                    self.state = RoomState(text: text, source: source, updatedAt: updatedAt)
                    debugLog("[STATE] published to UI: \"\(text.prefix(40))\" (\(debugMs(from: receivedAt)) after receipt)")

                    #if DEBUG
                    // Feed the auto-test driver. serverAgeMs is measured at
                    // callback receipt, same as the [SNAPSHOT] age log line.
                    let serverAgeMs = updatedAt.map {
                        Int(receivedAt.timeIntervalSince($0) * 1000)
                    } ?? -1
                    NotificationCenter.default.post(
                        name: .ffPublished, object: nil,
                        userInfo: [
                            "text": text,
                            "serverAgeMs": serverAgeMs,
                            "hopMs": hopMs,
                            "receivedAt": receivedAt,
                            "pendingWrites": snapshot.metadata.hasPendingWrites,
                        ]
                    )
                    #endif
                }
            }
    }
}
