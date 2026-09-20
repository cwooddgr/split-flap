// Web half of the shared layout spec. Run from the repo root: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CHARSET, layoutText } from '../layout.js';

const spec = JSON.parse(readFileSync(new URL('../shared/layout-fixtures.json', import.meta.url), 'utf8'));

test('charset matches the spec and has no duplicates', () => {
    assert.equal(CHARSET, spec.charset);
    assert.equal(new Set(CHARSET).size, CHARSET.length);
    assert.equal(CHARSET[0], ' ');
});

for (const c of spec.cases) {
    test(c.name, () => {
        const board = layoutText(c.text, c.cols, c.rows);
        assert.deepEqual(board, c.expected);
        assert.equal(board.length, c.rows);
        for (const row of board) {
            assert.equal(row.length, c.cols);
            for (const ch of row) assert.ok(CHARSET.includes(ch), `"${ch}" is not in the charset`);
        }
    });
}

test('non-string input is coerced, not thrown on', () => {
    assert.deepEqual(layoutText(undefined, 21, 6), layoutText('', 21, 6));
    assert.deepEqual(layoutText(42, 21, 6), layoutText('42', 21, 6));
});
