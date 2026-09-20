import Foundation

/// Board layout: turns a message into exactly `rows` strings of `cols`
/// characters, uppercased and limited to `BoardCharset`.
///
/// Swift port of layout.js at the repo root. Both are checked against
/// shared/layout-fixtures.json, which is the spec: change behavior by changing
/// a fixture first, then make both ports pass (`cd tvos && swift test`).
/// This folder has no UI imports so it can build as a plain Swift package.
enum BoardLayout {
    static func layout(message: String, cols: Int, rows: Int) -> [String] {
        // Lines past the last row are dropped.
        let lines = wrapText(sanitize(message), cols: cols)
            .prefix(rows)
            .map(trimTrailingSpaces)

        // Center the block horizontally on its widest line; lines stay
        // left-justified within the block.
        let widest = lines.map(\.count).max() ?? 0
        let margin = max(0, (cols - widest) / 2)

        // Center vertically; an odd spare row goes below.
        let topBlank = (rows - lines.count) / 2

        return (0..<rows).map { row in
            let index = row - topBlank
            let line = lines.indices.contains(index) ? lines[index] : ""
            let padded = String(repeating: " ", count: margin) + line
            return String(padded.prefix(cols)) + String(repeating: " ", count: max(0, cols - padded.count))
        }
    }

    /// Make text displayable: one line-ending style, accents folded to their
    /// base letter (CAFÉ shows as CAFE, not "CAF "), uppercase, and every
    /// Unicode scalar the board has no flap for replaced by a space. Done before
    /// measuring, so that what gets wrapped is what gets shown (ß becomes SS,
    /// which is two columns).
    ///
    /// Works on scalars, not Characters, to match JavaScript's code points: an
    /// emoji made of several scalars becomes several spaces on both platforms.
    /// Everything that survives is a single-scalar character, so `count` below
    /// agrees with JavaScript's `length`.
    private static func sanitize(_ text: String) -> String {
        let unified = text
            .replacingOccurrences(of: "\r\n", with: "\n")
            .replacingOccurrences(of: "\r", with: "\n")
        var folded = String.UnicodeScalarView()
        for scalar in unified.decomposedStringWithCanonicalMapping.unicodeScalars
        where !(0x0300...0x036F).contains(scalar.value) {
            folded.append(scalar)
        }
        var out = String.UnicodeScalarView()
        for scalar in String(folded).uppercased().unicodeScalars {
            let keep = scalar == "\n" || BoardCharset.index[Character(scalar)] != nil
            out.append(keep ? scalar : " ")
        }
        return String(out)
    }

    /// Wrap each input line at spaces. Runs of spaces inside a line are kept as
    /// typed; a word longer than the board is broken across lines, not cut off.
    private static func wrapText(_ text: String, cols: Int) -> [String] {
        var wrapped: [String] = []
        for line in text.split(separator: "\n", omittingEmptySubsequences: false) {
            if line.count <= cols {
                wrapped.append(String(line))
                continue
            }
            var current = ""
            for piece in line.split(separator: " ", omittingEmptySubsequences: false) {
                var word = String(piece)
                let candidate = current.isEmpty ? word : current + " " + word
                if candidate.count <= cols {
                    current = candidate
                    continue
                }
                if !current.isEmpty {
                    wrapped.append(current)
                }
                while word.count > cols {
                    wrapped.append(String(word.prefix(cols)))
                    word = String(word.dropFirst(cols))
                }
                current = word
            }
            if !current.isEmpty {
                wrapped.append(current)
            }
        }
        return wrapped
    }

    private static func trimTrailingSpaces(_ line: String) -> String {
        var line = line
        while line.last == " " {
            line.removeLast()
        }
        return line
    }
}
