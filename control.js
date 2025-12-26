import { db, doc, setDoc, serverTimestamp, ensureSignedIn } from './firebase-init.js';

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

(async () => {
    // Wait for anonymous auth so Firestore rules allow access
    await ensureSignedIn();

    const roomRef = doc(db, 'rooms', roomId);

    const textInput = document.getElementById('textInput');
    const displayBtn = document.getElementById('displayBtn');
    const randomBtn = document.getElementById('randomBtn');
    const funnyBtn = document.getElementById('funnyBtn');
    const clearBtn = document.getElementById('clearBtn');

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

    const funnyTexts = [
        'MY WALLET IS LIKE\nAN ONION\nOPENING IT\nMAKES ME CRY',
        'I FOLLOWED MY HEART\nAND IT LED ME\nTO THE FRIDGE',
        'MY BRAIN HAS\nTOO MANY TABS OPEN',
        'COMMON SENSE IS\nLIKE DEODORANT\nTHOSE WHO NEED IT\nNEVER USE IT',
        'I PUT THE PRO\nIN PROCRASTINATE',
        "I'M NOT SHORT\nI'M CONCENTRATED\nAWESOME",
        'MY PATIENCE IS\nLIKE MY PHONE\nALWAYS LOW',
        "I'M ON A SEAFOOD\nDIET\nI SEE FOOD\nAND I EAT IT",
        'SILENCE IS GOLDEN\nUNLESS YOU HAVE\nKIDS\nTHEN IT IS\nSUSPICIOUS',
        'I NEED A HUG\nE GLASS OF WINE',
        "I'M NOT BOSSY\nI JUST KNOW WHAT\nYOU SHOULD BE DOING",
        'MY HOUSEKEEPING\nSTYLE IS BEST\nDESCRIBED AS\nTHERE APPEARS TO\nHAVE BEEN A\nSTRUGGLE',
        'ADULTING IS SOUP\nAND I AM A FORK',
        "I DON'T NEED\nGOOGLE\nMY WIFE\nKNOWS EVERYTHING",
        'I WHISPER WTF\nTO MYSELF\nAT LEAST 20 TIMES\nA DAY',
        "I'M NOT LATE\nI'M JUST EARLY\nFOR TOMORROW",
        'MY BED AND I\nHAVE A SPECIAL\nRELATIONSHIP\nWE ARE PERFECT\nFOR EACH OTHER',
        "I'M SORRY FOR\nWHAT I SAID\nWHEN I WAS HUNGRY",
        'SOME DAYS I AMAZE\nMYSELF\nOTHER DAYS I PUT\nMY KEYS IN THE\nFRIDGE',
        "I CAN'T ADULT\nTODAY\nPLEASE DON'T\nMAKE ME ADULT",
        'I HAVE CDO\nIT IS LIKE OCD\nBUT THE LETTERS\nARE IN ORDER\nAS THEY SHOULD BE',
        "LIFE IS SHORT\nEAT DESSERT FIRST",
        'MY LEVEL OF\nSARCASM DEPENDS ON\nYOUR LEVEL OF\nSTUPIDITY',
        'I RUN ON\nCAFFEINE\nCHAOS\nAND CUSS WORDS',
        "I'M NOT LAZY\nI AM IN\nENERGY SAVING MODE",
        'EXERCISE?\nI THOUGHT YOU SAID\nEXTRA FRIES',
        'HOME IS WHERE\nTHE WIFI\nCONNECTS\nAUTOMATICALLY',
        "DON'T FOLLOW ME\nI RUN INTO WALLS",
        'I TRIED TO BE\nNORMAL ONCE\nWORST TWO MINUTES\nOF MY LIFE',
        'MY FAVORITE\nEXERCISE IS A\nCROSS BETWEEN\nA LUNGE AND A CRUNCH\nI CALL IT LUNCH',
    ];

    async function sendText(source) {
        if (!textInput) return;
        const text = textInput.value || '';

        // Set a rolling expiration so old rooms are cleaned up automatically
        // by Firestore TTL. We keep each room alive for 7 days after the last
        // update. The TTL policy should target the `expiresAt` field.
        const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
        const expiresAt = new Date(Date.now() + WEEK_MS);

        try {
            await setDoc(
                roomRef,
                {
                    text,
                    updatedAt: serverTimestamp(),
                    expiresAt,
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

    if (funnyBtn) {
        funnyBtn.addEventListener('click', () => {
            const funnyText =
                funnyTexts[Math.floor(Math.random() * funnyTexts.length)];
            if (textInput) {
                textInput.value = funnyText;
            }
            void sendText('funny');
        });
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (textInput) {
                textInput.value = '';
            }
            void sendText('clear');
        });
    }

    // Show a QR code for this controller page (same room), so another
    // phone can quickly join as a second remote.
    const remoteQrEl = document.getElementById('remote-qrcode');
    if (remoteQrEl && window.QRCode) {
        const url = window.location.href;
        // eslint-disable-next-line no-new
        new QRCode(remoteQrEl, {
            text: url,
            width: 72,
            height: 72,
            colorDark: '#000000',
            colorLight: '#ffffff',
            correctLevel: window.QRCode.CorrectLevel.M,
        });
    }
})();

