// Split-flap display module
// Extracted from the original script.js so it can be reused by both pages.

// Supported characters for the split-flap display.
// Includes:
// - Space, A–Z, 0–9
// - Common ASCII punctuation
// - Smart quotes ‘ ’ “ ” and degree symbol °
// - En dash, em dash, ellipsis – — …
const CHARSET =
    ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.:!?-,;\'"()/@#$%&*+=<>[]{}|~‘’“”°–—…';

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
        this.flaps = [];
        this.audioContext = null;
        this.init();
        this.initAudio();
    }

    initAudio() {
        // Initialize Web Audio API for click sounds
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

        // iOS/Safari require user interaction to enable audio
        const enableAudio = () => {
            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }
            // Remove listeners after first interaction
            document.removeEventListener('touchstart', enableAudio);
            document.removeEventListener('click', enableAudio);
        };

        document.addEventListener('touchstart', enableAudio, { once: true });
        document.addEventListener('click', enableAudio, { once: true });
    }

    playClickSound() {
        if (!this.audioContext) return;

        const now = this.audioContext.currentTime;

        // Create a sharp mechanical click using noise
        const bufferSize = this.audioContext.sampleRate * 0.03; // 30ms buffer
        const buffer = this.audioContext.createBuffer(
            1,
            bufferSize,
            this.audioContext.sampleRate
        );
        const data = buffer.getChannelData(0);

        // Generate noise that decays quickly for a click sound
        for (let i = 0; i < bufferSize; i++) {
            const decay = Math.exp(-i / (bufferSize * 0.1));
            data[i] = (Math.random() * 2 - 1) * decay;
        }

        const source = this.audioContext.createBufferSource();
        const gainNode = this.audioContext.createGain();

        source.buffer = buffer;
        source.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        // Quick, punchy click
        gainNode.gain.setValueAtTime(0.2, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.03);

        source.start(now);
    }

    init() {
        // Create rows and flap elements
        for (let row = 0; row < this.rows; row++) {
            const rowDiv = document.createElement('div');
            rowDiv.className = 'display-row';

            const rowFlaps = [];

            for (let col = 0; col < this.cols; col++) {
                const flapContainer = document.createElement('div');
                flapContainer.className = 'flap-container';

                const flap = document.createElement('div');
                flap.className = 'flap';

                // Create top half
                const topHalf = document.createElement('div');
                topHalf.className = 'flap-half flap-top';
                const topContent = document.createElement('div');
                topContent.className = 'flap-content';
                topContent.textContent = ' ';
                topHalf.appendChild(topContent);

                // Create bottom half
                const bottomHalf = document.createElement('div');
                bottomHalf.className = 'flap-half flap-bottom';
                const bottomContent = document.createElement('div');
                bottomContent.className = 'flap-content';
                bottomContent.textContent = ' ';
                bottomHalf.appendChild(bottomContent);

                flap.appendChild(topHalf);
                flap.appendChild(bottomHalf);
                flapContainer.appendChild(flap);
                rowDiv.appendChild(flapContainer);

                rowFlaps.push({
                    container: flapContainer,
                    topContent: topContent,
                    bottomContent: bottomContent,
                    currentChar: ' ',
                    targetChar: ' ',
                    timeoutId: null,
                    animationId: 0,
                });
            }

            this.flaps.push(rowFlaps);
            this.container.appendChild(rowDiv);
        }
    }

    wrapText(text, maxCols) {
        // Split text into lines first
        const inputLines = text.split('\n');
        const wrappedLines = [];

        inputLines.forEach((line) => {
            // If line fits, use it as-is
            if (line.length <= maxCols) {
                wrappedLines.push(line);
                return;
            }

            // Otherwise, wrap at word boundaries
            const words = line.split(' ');
            let currentLine = '';

            words.forEach((word) => {
                const testLine = currentLine ? currentLine + ' ' + word : word;

                if (testLine.length <= maxCols) {
                    currentLine = testLine;
                } else {
                    // Current line is full, start a new line
                    if (currentLine) {
                        wrappedLines.push(currentLine);
                    }
                    // If a single word is longer than maxCols, truncate it
                    currentLine =
                        word.length > maxCols ? word.substring(0, maxCols) : word;
                }
            });

            // Add the last line
            if (currentLine) {
                wrappedLines.push(currentLine);
            }
        });

        return wrappedLines;
    }

    setText(text) {
        if (typeof text !== 'string') {
            text = String(text ?? '');
        }

        // Wrap text at word boundaries
        let lines = this.wrapText(text, this.cols);

        // Limit to available rows
        lines = lines.slice(0, this.rows);

        // Pad to required number of rows
        while (lines.length < this.rows) {
            lines.push('');
        }

        // Process each line
        lines.forEach((line, rowIndex) => {
            // Pad or truncate line to fit display
            line = line.toUpperCase().padEnd(this.cols, ' ').substring(0, this.cols);

            // Trigger animation for each flap in this row
            line.split('').forEach((char, colIndex) => {
                if (!CHARSET.includes(char)) {
                    char = ' ';
                }
                this.flaps[rowIndex][colIndex].targetChar = char;
                this.animateFlap(rowIndex, colIndex);
            });
        });
    }

    animateFlap(row, col) {
        const flap = this.flaps[row][col];

        // Cancel any existing pending animation step for this flap
        if (flap.timeoutId !== null) {
            clearTimeout(flap.timeoutId);
            flap.timeoutId = null;
        }

        // Remove any leftover flip elements from a previous animation
        const existingFlips = flap.container.querySelectorAll('.flap-flip');
        existingFlips.forEach((el) => el.remove());

        // Bump animation id so old sequences know they're obsolete
        flap.animationId += 1;
        const animationId = flap.animationId;

        if (flap.currentChar === flap.targetChar) {
            return; // Already showing the target character
        }

        const currentIndex = CHARSET.indexOf(flap.currentChar);
        const targetIndex = CHARSET.indexOf(flap.targetChar);

        // Calculate the shortest path through the character set
        let steps = targetIndex - currentIndex;
        if (steps < 0) {
            steps += CHARSET.length;
        }

        this.flipSequence(row, col, steps, 0, animationId);
    }

    flipSequence(row, col, totalSteps, currentStep, animationId) {
        if (currentStep >= totalSteps) {
            return;
        }

        const flap = this.flaps[row][col];

        // If a newer animation has started for this flap, abort this sequence
        if (animationId !== flap.animationId) {
            return;
        }

        const currentIndex = CHARSET.indexOf(flap.currentChar);
        const nextIndex = (currentIndex + 1) % CHARSET.length;
        const nextChar = CHARSET[nextIndex];

        // Create animated flip element
        const flipElement = document.createElement('div');
        flipElement.className = 'flap-flip';
        const flipContent = document.createElement('div');
        flipContent.className = 'flap-content';
        flipContent.textContent = flap.currentChar;
        flipElement.appendChild(flipContent);

        flap.container.appendChild(flipElement);

        // Play click sound
        this.playClickSound();

        // Start animation
        setTimeout(() => {
            flipElement.classList.add('flipping');
        }, 10);

        // Update display after animation
        flap.timeoutId = setTimeout(() => {
            // If a newer animation has started since this timeout was scheduled, abort
            if (animationId !== flap.animationId) {
                // Ensure this flip element doesn't linger on screen
                flipElement.remove();
                return;
            }

            flap.currentChar = nextChar;
            flap.topContent.textContent = nextChar;
            flap.bottomContent.textContent = nextChar;
            flipElement.remove();

            // Continue sequence
            this.flipSequence(row, col, totalSteps, currentStep + 1, animationId);
        }, 100);
    }

    clear() {
        const emptyText = Array(this.rows).fill('').join('\n');
        this.setText(emptyText);
    }
}

export { SplitFlapDisplay };


