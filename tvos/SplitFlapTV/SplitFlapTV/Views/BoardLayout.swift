import Foundation

/// Swift port of the JavaScript layout logic in splitflap.js.
/// Given a message and board config, returns exactly `rows` strings of length
/// `cols`, with:
/// - Word-wrapped lines (wrap at spaces, truncating words longer than cols).
/// - The block of text centered horizontally and vertically.
/// - Each line uppercased, with left-justified content inside the centered block.
enum BoardLayout {
    static func layout(message: String, config: BoardConfig) -> [String] {
        // 1. Wrap text at word boundaries into lines
        var lines = wrapText(message, maxCols: config.cols)

        // 2. Limit to available rows
        if lines.count > config.rows {
            lines = Array(lines.prefix(config.rows))
        }

        // 3. Compute horizontal centering based on the widest line
        let contentWidths: [Int] = lines.map { line in
            rtrim(line).count
        }
        let maxContentWidth = contentWidths.max() ?? 0
        let horizontalMargin = max(0, (config.cols - maxContentWidth) / 2)

        // 4. Compute vertical centering (blank rows above and below)
        let blankRows = config.rows - lines.count
        let topBlank = blankRows > 0 ? blankRows / 2 : 0
        let bottomBlank = blankRows > 0 ? blankRows - topBlank : 0

        var centeredLines: [String] = []
        centeredLines.append(contentsOf: Array(repeating: "", count: topBlank))
        centeredLines.append(contentsOf: lines)
        centeredLines.append(contentsOf: Array(repeating: "", count: bottomBlank))

        // 5. Ensure exactly rows lines
        let finalLines = Array(centeredLines.prefix(config.rows))

        // 6. Build display lines with horizontal margin and padding
        return finalLines.map { line in
            let upper = line.uppercased()

            // Respect existing trailing spaces only up to content width
            let trimmedRight = rtrim(upper)
            let maxContentCols = max(config.cols - horizontalMargin, 0)
            let content = String(trimmedRight.prefix(maxContentCols))

            var displayLine = String(repeating: " ", count: horizontalMargin) + content
            if displayLine.count < config.cols {
                displayLine.append(
                    contentsOf: repeatElement(" ", count: config.cols - displayLine.count)
                )
            } else if displayLine.count > config.cols {
                displayLine = String(displayLine.prefix(config.cols))
            }

            return displayLine
        }
    }

    /// Port of wrapText(text, maxCols) from splitflap.js.
    /// - Splits by newlines first.
    /// - Wraps each line at word boundaries (spaces).
    /// - Truncates individual words longer than maxCols.
    private static func wrapText(_ text: String, maxCols: Int) -> [String] {
        let inputLines = text.split(separator: "\n", omittingEmptySubsequences: false)
        var wrappedLines: [String] = []

        for lineSub in inputLines {
            let line = String(lineSub)

            // If line fits, use it as-is
            if line.count <= maxCols {
                wrappedLines.append(line)
                continue
            }

            // Otherwise, wrap at word boundaries
            let words = line.split(separator: " ", omittingEmptySubsequences: false)
            var currentLine = ""

            for wordSub in words {
                let word = String(wordSub)

                // Preserve explicit multiple spaces by treating empty words
                // (from consecutive spaces) as a single space.
                let token = word.isEmpty ? " " : word

                let testLine = currentLine.isEmpty ? token : currentLine + " " + token

                if testLine.count <= maxCols {
                    currentLine = testLine
                } else {
                    if !currentLine.isEmpty {
                        wrappedLines.append(currentLine)
                    }
                    // If a single word is longer than maxCols, truncate it
                    if token.count > maxCols {
                        currentLine = String(token.prefix(maxCols))
                    } else {
                        currentLine = token
                    }
                }
            }

            if !currentLine.isEmpty {
                wrappedLines.append(currentLine)
            }
        }

        return wrappedLines
    }

    /// Remove trailing whitespace from a string (like JS .replace(/\s+$/u, "")).
    private static func rtrim(_ s: String) -> String {
        var scalars = s.unicodeScalars
        while let last = scalars.last, CharacterSet.whitespaces.contains(last) {
            scalars.removeLast()
        }
        return String(scalars)
    }
}


