import Foundation

/// The characters the board has a flap for (73), in flap order. Must equal
/// CHARSET in layout.js and `charset` in shared/layout-fixtures.json; the
/// layout tests check that.
enum BoardCharset {
    static let string =
        " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.:!?-,;'\"()/@#$%&*+=<>[]{}|~\u{2018}\u{2019}\u{201C}\u{201D}°–—…"

    static let characters: [Character] = Array(string)

    /// O(1) lookup table for character → index in `characters`.
    static let index: [Character: Int] = {
        var dict = [Character: Int](minimumCapacity: characters.count)
        for (i, c) in characters.enumerated() {
            dict[c] = i
        }
        return dict
    }()

    /// Advance a character one step through the charset toward the target.
    /// Returns the next character, or nil if already at target.
    static func advance(_ current: Character, toward target: Character) -> Character? {
        guard current != target else { return nil }

        guard let currentIndex = index[current] else {
            // Unknown character, snap to target
            return target
        }

        // Unreachable target (not in the charset): snap rather than cycle
        // forever. BoardLayout only emits charset characters, so this is a
        // safety net.
        guard index[target] != nil else {
            return target
        }

        return characters[(currentIndex + 1) % characters.count]
    }
}
