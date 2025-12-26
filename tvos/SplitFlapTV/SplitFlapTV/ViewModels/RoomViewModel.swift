import Foundation
import Combine
import UIKit
import Network
import FirebaseAuth
import FirebaseFirestore

/// Observable view model that mirrors the web client's Firestore behavior:
/// - Ensures an anonymous signed-in user.
/// - Listens to rooms/{roomId}.
/// - Publishes RoomState when the document changes.
/// - Automatically reconnects on errors, network restoration, or app lifecycle events.
final class RoomViewModel: ObservableObject {
    @Published var state: RoomState?
    @Published var errorMessage: String?
    /// Becomes true after we've successfully attached a Firestore listener for
    /// this room (i.e., after auth + startListening have completed).
    @Published var isReady: Bool = false

    let roomId: String

    private var listener: ListenerRegistration?
    private var foregroundObserver: NSObjectProtocol?
    private var networkMonitor: NWPathMonitor?
    private var wasDisconnected = false

    init(roomId: String) {
        self.roomId = roomId
        ensureSignedIn { [weak self] in
            self?.startListening()
        }

        // Resubscribe when app returns to foreground
        foregroundObserver = NotificationCenter.default.addObserver(
            forName: UIApplication.willEnterForegroundNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            self?.reconnect()
        }

        // Monitor network connectivity and reconnect when network is restored
        setupNetworkMonitor()
    }

    deinit {
        listener?.remove()
        networkMonitor?.cancel()
        if let observer = foregroundObserver {
            NotificationCenter.default.removeObserver(observer)
        }
    }

    private func setupNetworkMonitor() {
        networkMonitor = NWPathMonitor()
        networkMonitor?.pathUpdateHandler = { [weak self] path in
            DispatchQueue.main.async {
                if path.status == .satisfied {
                    // Network is available
                    if self?.wasDisconnected == true {
                        print("Network restored, reconnecting to Firestore...")
                        self?.wasDisconnected = false
                        self?.reconnect()
                    }
                } else {
                    // Network lost
                    print("Network connection lost")
                    self?.wasDisconnected = true
                }
            }
        }
        networkMonitor?.start(queue: DispatchQueue.global(qos: .background))
    }

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

    private func reconnect() {
        listener?.remove()
        listener = nil
        ensureSignedIn { [weak self] in
            self?.startListening()
        }
    }

    private func startListening() {
        let db = Firestore.firestore()

        listener = db.collection("rooms").document(roomId)
            .addSnapshotListener { [weak self] snapshot, error in
                // Mark the view model as ready as soon as we have a listener.
                if let self = self, !self.isReady {
                    self.isReady = true
                }

                DispatchQueue.main.async {
                    if let error = error {
                        self?.errorMessage = "Listen error: \(error.localizedDescription)"
                        // Attempt to reconnect after a short delay
                        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) { [weak self] in
                            self?.reconnect()
                        }
                        return
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

                    self?.state = RoomState(text: text, source: source, updatedAt: updatedAt)
                }
            }
    }
}


