import Foundation
import Testing
@testable import FlipFlapLayout

/// tvOS half of the shared layout spec (shared/layout-fixtures.json). The web
/// half is tests/layout.test.mjs.
struct Spec: Decodable {
    struct Case: Decodable, CustomTestStringConvertible {
        let name: String
        let text: String
        let cols: Int
        let rows: Int
        let expected: [String]
        var testDescription: String { name }
    }

    let charset: String
    let cases: [Case]

    static let shared: Spec = {
        let url = URL(fileURLWithPath: #filePath)   // tvos/LayoutTests/LayoutTests.swift
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appendingPathComponent("shared/layout-fixtures.json")
        return try! JSONDecoder().decode(Spec.self, from: Data(contentsOf: url))
    }()
}

@Test func charsetMatchesTheSpec() {
    #expect(BoardCharset.string == Spec.shared.charset)
    #expect(Set(BoardCharset.characters).count == BoardCharset.characters.count)
    #expect(BoardCharset.characters.count == 73)
    #expect(BoardCharset.characters.first == " ")
}

@Test(arguments: Spec.shared.cases)
func layoutMatchesTheSpec(_ c: Spec.Case) {
    let board = BoardLayout.layout(message: c.text, cols: c.cols, rows: c.rows)
    #expect(board == c.expected)
    #expect(board.count == c.rows)
    for row in board {
        #expect(row.count == c.cols)
        #expect(row.allSatisfy { BoardCharset.index[$0] != nil })
    }
}

@Test func advanceStepsForwardAndWraps() {
    #expect(BoardCharset.advance("A", toward: "A") == nil)
    #expect(BoardCharset.advance(" ", toward: "C") == "A")
    #expect(BoardCharset.advance("…", toward: "A") == " ")   // last wraps to first
}

@Test func advanceSnapsWhenEitherEndIsOffTheCharset() {
    #expect(BoardCharset.advance("é", toward: "B") == "B")
    #expect(BoardCharset.advance("A", toward: "é") == "é")
}

/// Every tile reaches its target in fewer steps than the charset has characters.
@Test func advanceAlwaysTerminates() {
    for start in BoardCharset.characters {
        for target in BoardCharset.characters {
            var current = start
            var steps = 0
            while let next = BoardCharset.advance(current, toward: target) {
                current = next
                steps += 1
                if steps > BoardCharset.characters.count { break }
            }
            #expect(current == target && steps < BoardCharset.characters.count)
        }
    }
}
