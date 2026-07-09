import Foundation
import Combine
import FirebaseAuth
import FirebaseFirestore

/// Observable view model that mirrors the web client's Firestore behavior:
/// - Ensures an anonymous signed-in user.
/// - Listens to rooms/{roomId}.
/// - Publishes RoomState when the document changes.
/// - Proactively refreshes auth token before expiry.
/// - Health checks to detect connection failures and auto-reconnect.
/// Debug logging lives in DebugLog.swift (timestamped, DEBUG builds only).

final class RoomViewModel: ObservableObject {
    @Published var state: RoomState?
    @Published var errorMessage: String?
    /// Becomes true after authentication succeeds, allowing the UI to display
    /// the QR code immediately without waiting for Firestore connectivity.
    @Published var isReady: Bool = false
    /// Indicates whether we have an active connection to Firestore.
    @Published var isConnected: Bool = true

    let roomId: String

    // MARK: - Connection Management

    private var listener: ListenerRegistration?
    private var healthCheckTimer: Timer?
    private var tokenRefreshTimer: Timer?

    private let healthCheckInterval: TimeInterval = 5 * 60 // 5 minutes
    private let tokenRefreshInterval: TimeInterval = 55 * 60 // 55 minutes
    private let offlineThreshold: TimeInterval = 60 // 60 seconds

    private var lastServerResponseTime: Date = Date()
    private var isReconnecting: Bool = false

    // MARK: - Initialization

    init(roomId: String) {
        self.roomId = roomId
        ensureSignedIn { [weak self] in
            self?.startListening()
            self?.startHealthCheck()
            self?.startTokenRefresh()
        }
    }

    deinit {
        listener?.remove()
        healthCheckTimer?.invalidate()
        tokenRefreshTimer?.invalidate()
    }

    // MARK: - Authentication

    private func ensureSignedIn(completion: @escaping () -> Void) {
        let auth = Auth.auth()

        if auth.currentUser != nil {
            completion()
            return
        }

        auth.signInAnonymously { [weak self] _, error in
            DispatchQueue.main.async {
                if let error = error {
                    self?.errorMessage = "Auth error: \(error.localizedDescription)"
                } else {
                    completion()
                }
            }
        }
    }

    private func forceReauthenticate(completion: @escaping () -> Void) {
        let auth = Auth.auth()

        debugLog("[RECONNECT] Force re-authenticating (sign out + sign in)...")

        // Sign out first
        do {
            try auth.signOut()
            debugLog("[RECONNECT] Signed out successfully")
        } catch {
            debugLog("[RECONNECT] Sign out failed (may already be signed out): \(error.localizedDescription)")
        }

        // Sign in fresh
        auth.signInAnonymously { [weak self] _, error in
            DispatchQueue.main.async {
                if let error = error {
                    debugLog("[RECONNECT] Re-auth failed: \(error.localizedDescription)")
                    self?.errorMessage = "Re-auth error: \(error.localizedDescription)"
                    self?.isReconnecting = false
                } else {
                    debugLog("[RECONNECT] Re-authentication successful")
                    completion()
                }
            }
        }
    }

    // MARK: - Firestore Listener

    private func startListening() {
        // Mark as ready immediately after auth succeeds - the QR code only
        // needs the roomId, not Firestore connectivity.
        isReady = true

        let db = Firestore.firestore()

        debugLog("[LISTENER] Setting up Firestore listener for room: \(roomId)")

        listener = db.collection("rooms").document(roomId)
            .addSnapshotListener { [weak self] snapshot, error in
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

                    if let error = error {
                        debugLog("[ERROR] Snapshot listener error: \(error.localizedDescription)")
                        self.errorMessage = "Listen error: \(error.localizedDescription)"
                        self.handleConnectionFailure()
                        return
                    }

                    // Track connection state via metadata
                    if let snapshot = snapshot {
                        if !snapshot.metadata.isFromCache {
                            self.lastServerResponseTime = Date()
                            if !self.isConnected {
                                debugLog("[STATE] Connection restored")
                            }
                            self.isConnected = true
                            debugLog("[SNAPSHOT] Server response - updating lastServerResponseTime")
                        } else {
                            debugLog("[SNAPSHOT] Cache response - NOT updating lastServerResponseTime")
                        }
                    }

                    guard let data = snapshot?.data(),
                          let text = data["text"] as? String
                    else {
                        // No doc or no text field; leave state unchanged.
                        return
                    }

                    let source = data["source"] as? String
                    var updatedAt: Date?

                    if let ts = data["updatedAt"] as? Timestamp {
                        updatedAt = ts.dateValue()
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
                            "pendingWrites": snapshot?.metadata.hasPendingWrites ?? false,
                        ]
                    )
                    #endif
                }
            }
    }

    // MARK: - Health Check

    private func startHealthCheck() {
        debugLog("[HEALTH] Starting health check interval (every 5 min)")
        healthCheckTimer = Timer.scheduledTimer(withTimeInterval: healthCheckInterval, repeats: true) { [weak self] _ in
            self?.performHealthCheck()
        }
    }

    private func performHealthCheck() {
        let timeSinceLastResponse = Date().timeIntervalSince(lastServerResponseTime)
        debugLog("[HEALTH] Health check tick - performing active ping (last response: \(Int(timeSinceLastResponse))s ago)")

        let db = Firestore.firestore()
        db.collection("rooms").document(roomId).getDocument { [weak self] snapshot, error in
            guard let self = self else { return }

            DispatchQueue.main.async {
                if let error = error {
                    debugLog("[HEALTH] Ping failed: \(error.localizedDescription)")
                    let elapsed = Date().timeIntervalSince(self.lastServerResponseTime)
                    if elapsed > self.offlineThreshold {
                        self.handleConnectionFailure()
                    }
                    return
                }

                if snapshot?.metadata.isFromCache == false {
                    self.lastServerResponseTime = Date()
                    self.isConnected = true
                    debugLog("[HEALTH] Ping successful - connection confirmed alive")
                } else {
                    debugLog("[HEALTH] Ping returned cached data - checking threshold")
                    let elapsed = Date().timeIntervalSince(self.lastServerResponseTime)
                    if elapsed > self.offlineThreshold {
                        debugLog("[HEALTH] Over threshold (\(Int(elapsed))s > \(Int(self.offlineThreshold))s) - attempting reconnect")
                        self.handleConnectionFailure()
                    }
                }
            }
        }
    }

    // MARK: - Token Refresh

    private func startTokenRefresh() {
        debugLog("[TOKEN] Starting proactive token refresh interval (every 55 min)")
        tokenRefreshTimer = Timer.scheduledTimer(withTimeInterval: tokenRefreshInterval, repeats: true) { [weak self] _ in
            self?.refreshAuthToken()
        }
    }

    private func refreshAuthToken() {
        guard let user = Auth.auth().currentUser else {
            debugLog("[TOKEN] No current user - skipping refresh")
            return
        }

        debugLog("[TOKEN] Proactively refreshing auth token before expiry")
        user.getIDTokenForcingRefresh(true) { token, error in
            if let error = error {
                debugLog("[TOKEN] Refresh failed: \(error.localizedDescription)")
            } else {
                debugLog("[TOKEN] Auth token refreshed successfully")
            }
        }
    }

    // MARK: - Connection Failure Handling

    private func handleConnectionFailure() {
        guard !isReconnecting else {
            debugLog("[RECONNECT] Already reconnecting, skipping")
            return
        }

        isReconnecting = true
        isConnected = false

        debugLog("[RECONNECT] Attempting full reconnect - teardown and rebuild listener")

        // Remove existing listener
        if listener != nil {
            debugLog("[RECONNECT] Unsubscribing existing listener")
            listener?.remove()
            listener = nil
        }

        // Force re-authenticate and rebuild listener
        forceReauthenticate { [weak self] in
            debugLog("[RECONNECT] Setting up new Firestore listener")
            self?.startListening()
            self?.isReconnecting = false
        }
    }
}
