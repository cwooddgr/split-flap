import Foundation

/// Board configuration, mirroring the BoardConfig concept in shared/protocol.ts.
/// These values should stay in sync with the web client (see docs/PROTOCOL.md).
struct BoardConfig {
    let cols: Int
    let rows: Int
}

/// Firestore document shape for rooms/{roomId}, mirrored from shared/protocol.ts
/// and docs/PROTOCOL.md. In Firestore, `updatedAt` is a Timestamp; here we use
/// `Date?` for convenience. Mapping from Timestamp → Date will be done where
/// the Firestore SDK is used.
struct RoomState: Decodable {
    let text: String
    let source: String?
    let updatedAt: Date?
}


