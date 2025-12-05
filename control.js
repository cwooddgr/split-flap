import { db, doc, setDoc, serverTimestamp } from './firebase-init.js';

// Room id can come from either the query string (?room=ABC123) or the hash (#room=ABC123)
const params = new URLSearchParams(window.location.search);
let rawRoomId = params.get('room');

if (!rawRoomId) {
    const hash = window.location.hash.startsWith('#')
        ? window.location.hash.slice(1)
        : window.location.hash;

    if (hash) {
        const hashParams = new URLSearchParams(hash);
        rawRoomId = hashParams.get('room') || hash;
    } else {
        rawRoomId = '';
    }
}

const roomId = (rawRoomId || '').toUpperCase().trim();

const controlsEl = document.querySelector('.controls');
const errorEl = document.getElementById('roomError');

function isValidRoom(id) {
    return /^[A-Z0-9]{4,12}$/.test(id);
}

if (!roomId || !isValidRoom(roomId)) {
    if (controlsEl) {
        controlsEl.style.display = 'none';
    }
    if (errorEl) {
        errorEl.hidden = false;
    }
    throw new Error('Invalid or missing room id. Please rescan the QR code.');
}

const roomRef = doc(db, 'rooms', roomId);

const textInput = document.getElementById('textInput');
const displayBtn = document.getElementById('displayBtn');
const randomBtn = document.getElementById('randomBtn');

const randomTexts = [
    'IF YOU WANT\nTO FIND HAPPINESS\nFIND GRATITUDE',
    'EVERY MOMENT\nIS A FRESH\nBEGINNING',
    'DREAM BIG\nWORK HARD\nSTAY FOCUSED',
    'THE BEST WAY OUT\nIS ALWAYS\nTHROUGH',
    'BE THE CHANGE\nYOU WISH TO SEE\nIN THE WORLD',
    "LIFE IS WHAT HAPPENS\nWHEN YOU'RE BUSY\nMAKING OTHER PLANS",
    'I TOLD MY WIFE\nSHE DRAWS EYEBROWS\nTOO HIGH\nSHE LOOKED SURPRISED',
    'COFFEE: BECAUSE\nADULTING IS HARD',
    "I'M NOT LAZY\nI'M JUST ON\nENERGY SAVING MODE",
    'MY BED IS A\nMAGICAL PLACE\nWHERE I SUDDENLY\nREMEMBER EVERYTHING',
    'I NEED A SIX MONTH\nVACATION\nTWICE A YEAR',
    'CTRL + ALT + DEL\nFOR LIFE PLEASE',
    'DO I RUN?\nYES: OUT OF TIME\nMONEY AND PATIENCE',
    "I CAME. I SAW.\nI FORGOT WHAT\nI WAS DOING.",
    'ERROR 404:\nMOTIVATION\nNOT FOUND',
    "PROCAFFEINATING:\nDOING NOTHING UNTIL\nYOU'VE HAD COFFEE",
    "WEEKENDS DON'T\nCOUNT UNLESS YOU\nSPEND THEM DOING\nSOMETHING USELESS",
    'ALWAYS BORROW\nMONEY FROM A\nPESSIMIST. THEY\nNEVER EXPECT IT BACK',
    "LIFE IS SHORT.\nSMILE WHILE YOU\nSTILL HAVE TEETH",
    "I'M NOT ARGUING\nI'M JUST EXPLAINING\nWHY I'M RIGHT",
    'FRIDAY IS MY\nSECOND FAVORITE\nF WORD',
    'CHOCOLATE COMES\nFROM COCOA\nWHICH IS A TREE.\nTHAT MAKES IT A SALAD',
    'BE YOURSELF:\nEVERYONE ELSE\nIS TAKEN',
    "TODAY'S FORECAST:\n100% CHANCE OF\nWINNING",
    'SARCASM: BECAUSE\nMURDER IS ILLEGAL',
    "I DON'T HAVE A\nSHORT ATTENTION\nSPAN I JUST...\nOH LOOK A BIRD",
    "TIME FLIES WHEN\nYOU'RE AVOIDING\nWHAT YOU'RE\nSUPPOSED TO DO",
    'REALITY CALLED.\nI HUNG UP.',
    'STRESSED SPELLED\nBACKWARDS IS\nDESSERTS.\nCOINCIDENCE?',
    'MY SUPERPOWER IS\nMAKING PEOPLE\nUNCOMFORTABLE WITH\nMY HONESTY',
    'WHEN NOTHING GOES\nRIGHT\nGO LEFT',
    "EVERYTHING I LIKE\nIS EITHER ILLEGAL\nEXPENSIVE OR\nWON'T TEXT ME BACK",
    "I'M NOT WEIRD\nI'M LIMITED EDITION",
    "DOING NOTHING IS\nHARD. YOU NEVER\nKNOW WHEN YOU'RE\nDONE",
    'WARNING: DATES IN\nCALENDAR ARE\nCLOSER THAN THEY\nAPPEAR',
    'IF PLAN A FAILS\nREMEMBER:\nTHERE ARE 25 MORE\nLETTERS',
];

async function sendText(source) {
    if (!textInput) return;
    const text = textInput.value || '';

    try {
        await setDoc(
            roomRef,
            {
                text,
                updatedAt: serverTimestamp(),
                source,
            },
            { merge: true }
        );
    } catch (err) {
        console.error('Error writing message to room', err);
    }
}

if (displayBtn) {
    displayBtn.addEventListener('click', () => {
        void sendText('manual');
    });
}

if (textInput) {
    textInput.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            void sendText('manual');
        }
    });
}

if (randomBtn) {
    randomBtn.addEventListener('click', () => {
        const randomText =
            randomTexts[Math.floor(Math.random() * randomTexts.length)];
        if (textInput) {
            textInput.value = randomText;
        }
        void sendText('random');
    });
}


