// Split-flap board for the web display. The same design as the tvOS board
// (Views/BoardView.swift): one clock for the whole board, every tile advancing
// one charset step per tick, and nothing created after init.
//
// Each tile has four faces that stay in the DOM:
//   top        (still)   the new character's top half, revealed behind the flap
//   bottom     (still)   the old character's bottom half, until the flap lands
//   fallTop    (moving)  the old top half, folding down to the split line
//   fallBottom (moving)  the new bottom half, swinging down from the split line
// The two moving faces each own one Animation made at init and replayed on every
// flip. It animates only transform and filter.

import { CHARSET, layoutText } from './layout.js';
import { FlipSound } from './sound.js';

// Timing matches the tvOS board.
const TICK_MS = 60;
const FLIP_MS = 40;
const MAX_STAGGER_MS = 18;

// The flap falls under gravity: eased = p². It is the old top half until
// eased reaches 0.5 (p = 0.707) and the new bottom half after that. Each
// cubic-bezier below is that parabola's segment, exactly.
const HANDOFF = Math.SQRT1_2;
const FALL_TOP_KEYFRAMES = [
    { offset: 0, transform: 'scaleY(1)', filter: 'brightness(1)', easing: 'cubic-bezier(0.333, 0, 0.667, 0.333)' },
    { offset: HANDOFF, transform: 'scaleY(0)', filter: 'brightness(0.5)' },
    { offset: 1, transform: 'scaleY(0)', filter: 'brightness(0.5)' },
];
const FALL_BOTTOM_KEYFRAMES = [
    { offset: 0, transform: 'scaleY(0)', filter: 'brightness(0.5)' },
    { offset: HANDOFF, transform: 'scaleY(0)', filter: 'brightness(0.5)', easing: 'cubic-bezier(0.333, 0.276, 0.667, 0.609)' },
    { offset: 1, transform: 'scaleY(1)', filter: 'brightness(1)' },
];

// Fixed per-tile delay so neighbors flip a few ms apart and not in unison.
function stagger(row, col) {
    return (((row * 7919 + col * 104729) % 977) / 977) * MAX_STAGGER_MS;
}

class SplitFlapDisplay {
    constructor(containerOrId, cols = 22, rows = 4) {
        const container =
            typeof containerOrId === 'string'
                ? document.getElementById(containerOrId)
                : containerOrId;

        if (!container) {
            throw new Error('SplitFlapDisplay: container element not found');
        }

        this.container = container;
        this.cols = cols;
        this.rows = rows;
        this.tiles = [];
        this.sound = new FlipSound();
        this.frameId = null;
        this.lastTickAt = 0;
        this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

        this.init();

        // A hidden tab gets no animation frames, so the board jumps to its
        // target and is right when the tab comes back.
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) this.snap();
        });
    }

    init() {
        // The stylesheet sizes the tiles from the viewport and the grid.
        this.container.style.setProperty('--cols', this.cols);
        this.container.style.setProperty('--rows', this.rows);

        const makeFace = (className) => {
            const face = document.createElement('div');
            face.className = `flap-half ${className}`;
            const content = document.createElement('div');
            content.className = 'flap-content';
            content.textContent = ' ';
            face.appendChild(content);
            return { face, content };
        };

        for (let row = 0; row < this.rows; row++) {
            const rowDiv = document.createElement('div');
            rowDiv.className = 'display-row';

            for (let col = 0; col < this.cols; col++) {
                const tileDiv = document.createElement('div');
                tileDiv.className = 'flap-container';

                const top = makeFace('flap-top');
                const bottom = makeFace('flap-bottom');
                const fallTop = makeFace('flap-top flap-fall');
                const fallBottom = makeFace('flap-bottom flap-fall');
                tileDiv.append(top.face, bottom.face, fallTop.face, fallBottom.face);
                rowDiv.appendChild(tileDiv);

                const timing = { duration: FLIP_MS, delay: stagger(row, col), fill: 'both' };
                const animations = [
                    fallTop.face.animate(FALL_TOP_KEYFRAMES, timing),
                    fallBottom.face.animate(FALL_BOTTOM_KEYFRAMES, timing),
                ];
                animations.forEach((animation) => animation.finish());

                this.tiles.push({
                    top: top.content,
                    bottom: bottom.content,
                    fallTop: fallTop.content,
                    fallBottom: fallBottom.content,
                    animations,
                    current: 0, // index into CHARSET
                    target: 0,
                });
            }

            this.container.appendChild(rowDiv);
        }
    }

    setText(text) {
        // layout.js returns exactly this.rows strings of this.cols characters,
        // already uppercased and limited to CHARSET.
        layoutText(text, this.cols, this.rows).forEach((line, row) => {
            Array.from(line).forEach((char, col) => {
                this.tiles[row * this.cols + col].target = CHARSET.indexOf(char);
            });
        });

        if (document.hidden || this.reducedMotion.matches) {
            this.snap();
        } else if (this.frameId === null && this.tiles.some((tile) => tile.current !== tile.target)) {
            // Backdated one tick so the first flip starts on the next frame.
            this.lastTickAt = performance.now() - TICK_MS;
            this.frameId = requestAnimationFrame((now) => this.frame(now));
        }
    }

    // The clock. Tiles only ever move on a tick, and a late frame advances them
    // by every tick it missed, so a slow machine skips steps and a message
    // still takes the same time to arrive.
    frame(now) {
        this.frameId = null;

        const steps = Math.floor((now - this.lastTickAt) / TICK_MS);
        if (steps >= 1) {
            this.lastTickAt += steps * TICK_MS;
            this.sound.play(this.advance(steps), TICK_MS / 1000);
        }

        if (this.tiles.some((tile) => tile.current !== tile.target)) {
            this.frameId = requestAnimationFrame((next) => this.frame(next));
        }
    }

    // Move every unfinished tile up to `steps` characters toward its target and
    // flip it. Returns how many tiles flipped.
    advance(steps) {
        let flipped = 0;
        for (const tile of this.tiles) {
            if (tile.current === tile.target) continue;

            const remaining = (tile.target - tile.current + CHARSET.length) % CHARSET.length;
            const oldChar = CHARSET[tile.current];
            tile.current = (tile.current + Math.min(steps, remaining)) % CHARSET.length;
            const newChar = CHARSET[tile.current];

            tile.top.textContent = newChar;
            tile.bottom.textContent = oldChar;
            tile.fallTop.textContent = oldChar;
            tile.fallBottom.textContent = newChar;
            for (const animation of tile.animations) {
                animation.currentTime = 0;
                animation.play();
            }
            flipped++;
        }
        return flipped;
    }

    // Jump to the target with no animation and no sound.
    snap() {
        if (this.frameId !== null) {
            cancelAnimationFrame(this.frameId);
            this.frameId = null;
        }
        for (const tile of this.tiles) {
            if (tile.current === tile.target) continue;
            tile.current = tile.target;
            const char = CHARSET[tile.current];
            tile.top.textContent = char;
            tile.bottom.textContent = char;
            tile.fallTop.textContent = char;
            tile.fallBottom.textContent = char;
            tile.animations.forEach((animation) => animation.finish());
        }
    }

    clear() {
        this.setText('');
    }
}

export { SplitFlapDisplay };
