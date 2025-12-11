// Shared TypeScript interfaces for the split-flap protocol.
// These mirror the documented shapes in docs/PROTOCOL.md and the current
// Firestore usage in the web app. They are for documentation and tooling only;
// no runtime dependency is required.

export interface BoardConfig {
  cols: number; // e.g., 21
  rows: number; // e.g., 6
  // Human-readable description of the allowed character set.
  charsetDescription?: string;
}

// Raw message as understood by controllers and displays.
export interface Message {
  text: string;
  // Where the message came from (manual input, random quote, seasonal, etc.)
  source?: string;
  // ISO timestamp or serialized Firestore Timestamp; optional.
  updatedAt?: string;
}

// Firestore document at rooms/{roomId}
export interface RoomState {
  text: string;
  source?: string;
  updatedAt?: string;
}

// Convenience wrapper combining room id, board config, and current state.
export interface RoomSnapshot {
  roomId: string;
  board: BoardConfig;
  state: RoomState;
}


