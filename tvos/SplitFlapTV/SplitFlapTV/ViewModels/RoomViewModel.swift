import Foundation
import Combine
import FirebaseAuth
import FirebaseFirestore

/// Observable view model that mirrors the web client's Firestore behavior:
/// - Ensures an anonymous signed-in user.
/// - Listens to rooms/{roomId}.
/// - Publishes RoomState when the document changes.
final class RoomViewModel: ObservableObject {
    @Published var state: RoomState?
    @Published var errorMessage: String?

    let roomId: String

    private var listener: ListenerRegistration?

    init(roomId: String) {
        self.roomId = roomId
        ensureSignedIn { [weak self] in
            self?.startListening()
        }
    }

    deinit {
        listener?.remove()
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

    private func startListening() {
        let db = Firestore.firestore()

        listener = db.collection("rooms").document(roomId)
            .addSnapshotListener { [weak self] snapshot, error in
                DispatchQueue.main.async {
                    if let error = error {
                        self?.errorMessage = "Listen error: \(error.localizedDescription)"
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


