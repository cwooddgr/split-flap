// Character set for the flap display
const CHARSET = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.:!?-,;\'\"()/@#$%&*+=<>[]{}|~';

class SplitFlapDisplay {
    constructor(containerId, cols = 22, rows = 4) {
        this.container = document.getElementById(containerId);
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
    }

    playClickSound() {
        if (!this.audioContext) return;
        
        const now = this.audioContext.currentTime;
        
        // Create a sharp mechanical click using noise
        const bufferSize = this.audioContext.sampleRate * 0.03; // 30ms buffer
        const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
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
                    targetChar: ' '
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
        
        inputLines.forEach(line => {
            // If line fits, use it as-is
            if (line.length <= maxCols) {
                wrappedLines.push(line);
                return;
            }
            
            // Otherwise, wrap at word boundaries
            const words = line.split(' ');
            let currentLine = '';
            
            words.forEach((word, index) => {
                const testLine = currentLine ? currentLine + ' ' + word : word;
                
                if (testLine.length <= maxCols) {
                    currentLine = testLine;
                } else {
                    // Current line is full, start a new line
                    if (currentLine) {
                        wrappedLines.push(currentLine);
                    }
                    // If a single word is longer than maxCols, truncate it
                    currentLine = word.length > maxCols ? word.substring(0, maxCols) : word;
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
        
        this.flipSequence(row, col, steps, 0);
    }

    flipSequence(row, col, totalSteps, currentStep) {
        if (currentStep >= totalSteps) {
            return;
        }

        const flap = this.flaps[row][col];
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
        setTimeout(() => {
            flap.currentChar = nextChar;
            flap.topContent.textContent = nextChar;
            flap.bottomContent.textContent = nextChar;
            flipElement.remove();
            
            // Continue sequence
            this.flipSequence(row, col, totalSteps, currentStep + 1);
        }, 50);
    }

    clear() {
        const emptyText = Array(this.rows).fill('').join('\n');
        this.setText(emptyText);
    }
}

// Initialize the display with 22 columns and 4 rows
const display = new SplitFlapDisplay('displayBoard', 22, 4);

// Event listeners
document.getElementById('displayBtn').addEventListener('click', () => {
    const text = document.getElementById('textInput').value;
    display.setText(text);
});

document.getElementById('textInput').addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        const text = document.getElementById('textInput').value;
        display.setText(text);
    }
});

document.getElementById('randomBtn').addEventListener('click', () => {
    const randomTexts = [
        'IF YOU WANT\nTO FIND HAPPINESS\nFIND GRATITUDE',
        'EVERY MOMENT\nIS A FRESH\nBEGINNING',
        'DREAM BIG\nWORK HARD\nSTAY FOCUSED',
        'THE BEST WAY OUT\nIS ALWAYS\nTHROUGH',
        'BE THE CHANGE\nYOU WISH TO SEE\nIN THE WORLD',
        'LIFE IS WHAT HAPPENS\nWHEN YOU\'RE BUSY\nMAKING OTHER PLANS',
        'I TOLD MY WIFE\nSHE DRAWS EYEBROWS\nTOO HIGH\nSHE LOOKED SURPRISED',
        'COFFEE: BECAUSE\nADULTING IS HARD',
        'I\'M NOT LAZY\nI\'M JUST ON\nENERGY SAVING MODE',
        'MY BED IS A\nMAGICAL PLACE\nWHERE I SUDDENLY\nREMEMBER EVERYTHING',
        'I NEED A SIX MONTH\nVACATION\nTWICE A YEAR',
        'CTRL + ALT + DEL\nFOR LIFE PLEASE',
        'DO I RUN?\nYES: OUT OF TIME\nMONEY AND PATIENCE',
        'I CAME. I SAW.\nI FORGOT WHAT\nI WAS DOING.',
        'ERROR 404:\nMOTIVATION\nNOT FOUND',
        'PROCAFFEINATING:\nDOING NOTHING UNTIL\nYOU\'VE HAD COFFEE',
        'WEEKENDS DON\'T\nCOUNT UNLESS YOU\nSPEND THEM DOING\nSOMETHING USELESS',
        'ALWAYS BORROW\nMONEY FROM A\nPESSIMIST. THEY\nNEVER EXPECT IT BACK',
        'LIFE IS SHORT.\nSMILE WHILE YOU\nSTILL HAVE TEETH',
        'I\'M NOT ARGUING\nI\'M JUST EXPLAINING\nWHY I\'M RIGHT',
        'FRIDAY IS MY\nSECOND FAVORITE\nF WORD',
        'CHOCOLATE COMES\nFROM COCOA\nWHICH IS A TREE.\nTHAT MAKES IT A SALAD',
        'BE YOURSELF:\nEVERYONE ELSE\nIS TAKEN',
        'TODAY\'S FORECAST:\n100% CHANCE OF\nWINNING',
        'SARCASM: BECAUSE\nMURDER IS ILLEGAL',
        'I DON\'T HAVE A\nSHORT ATTENTION\nSPAN I JUST...\nOH LOOK A BIRD',
        'TIME FLIES WHEN\nYOU\'RE AVOIDING\nWHAT YOU\'RE\nSUPPOSED TO DO',
        'REALITY CALLED.\nI HUNG UP.',
        'STRESSED SPELLED\nBACKWARDS IS\nDESSERTS.\nCOINCIDENCE?',
        'MY SUPERPOWER IS\nMAKING PEOPLE\nUNCOMFORTABLE WITH\nMY HONESTY',
        'WHEN NOTHING GOES\nRIGHT\nGO LEFT',
        'EVERYTHING I LIKE\nIS EITHER ILLEGAL\nEXPENSIVE OR\nWON\'T TEXT ME BACK',
        'I\'M NOT WEIRD\nI\'M LIMITED EDITION',
        'DOING NOTHING IS\nHARD. YOU NEVER\nKNOW WHEN YOU\'RE\nDONE',
        'WARNING: DATES IN\nCALENDAR ARE\nCLOSER THAN THEY\nAPPEAR',
        'IF PLAN A FAILS\nREMEMBER:\nTHERE ARE 25 MORE\nLETTERS'
    ];
    const randomText = randomTexts[Math.floor(Math.random() * randomTexts.length)];
    document.getElementById('textInput').value = randomText;
    display.setText(randomText);
});


