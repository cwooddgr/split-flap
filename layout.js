// Board layout: turns a message into exactly `rows` strings of `cols` characters.
//
// Pure (no DOM), so the display, a future remote preview, and the tests can all
// use it. The tvOS app has a Swift port of this file
// (tvos/SplitFlapTV/SplitFlapTV/Layout/BoardLayout.swift). Both are checked
// against shared/layout-fixtures.json, which is the spec: change behavior by
// changing a fixture first, then make both ports pass.

// Supported characters for the split-flap display (73), in flap order:
// - Space, A–Z, 0–9
// - Common ASCII punctuation
// - Smart quotes ‘ ’ “ ” and degree symbol °
// - En dash, em dash, ellipsis – — …
const CHARSET =
    ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.:!?-,;\'"()/@#$%&*+=<>[]{}|~‘’“”°–—…';

// Make text displayable: one line-ending style, accents folded to their base
// letter (CAFÉ shows as CAFE, not "CAF "), uppercase, and every code point the
// board has no flap for replaced by a space. Done before measuring, so that
// what gets wrapped is what gets shown (ß becomes SS, which is two columns).
function sanitize(text) {
    const folded = text
        .replace(/\r\n?/g, '\n')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toUpperCase();
    let out = '';
    for (const ch of folded) {
        out += ch === '\n' || CHARSET.includes(ch) ? ch : ' ';
    }
    return out;
}

// Wrap each input line at spaces. Runs of spaces inside a line are kept as
// typed; a word longer than the board is broken across lines, not cut off.
function wrapText(text, cols) {
    const wrapped = [];
    for (const line of text.split('\n')) {
        if (line.length <= cols) {
            wrapped.push(line);
            continue;
        }
        let current = '';
        for (let word of line.split(' ')) {
            const candidate = current ? current + ' ' + word : word;
            if (candidate.length <= cols) {
                current = candidate;
                continue;
            }
            if (current) {
                wrapped.push(current);
            }
            while (word.length > cols) {
                wrapped.push(word.substring(0, cols));
                word = word.substring(cols);
            }
            current = word;
        }
        if (current) {
            wrapped.push(current);
        }
    }
    return wrapped;
}

function layoutText(text, cols, rows) {
    if (typeof text !== 'string') {
        text = String(text ?? '');
    }

    // Lines past the last row are dropped.
    const lines = wrapText(sanitize(text), cols)
        .slice(0, rows)
        .map((line) => line.replace(/ +$/, ''));

    // Center the block horizontally on its widest line; lines stay
    // left-justified within the block.
    const widest = lines.reduce((max, line) => Math.max(max, line.length), 0);
    const margin = Math.max(0, Math.floor((cols - widest) / 2));

    // Center vertically; an odd spare row goes below.
    const topBlank = Math.floor((rows - lines.length) / 2);

    const board = [];
    for (let row = 0; row < rows; row++) {
        const line = lines[row - topBlank] ?? '';
        board.push((' '.repeat(margin) + line).padEnd(cols, ' ').substring(0, cols));
    }
    return board;
}

export { CHARSET, layoutText };
