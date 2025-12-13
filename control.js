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
    const christmasBtn = document.getElementById('christmasBtn');

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

    // Christmas / holiday messages adapted from Shutterfly's
    // "Christmas Card Sayings & Wishes" article:
    // https://www.shutterfly.com/ideas/christmas-card-sayings/
    const christmasTexts = [
        // Short Christmas Card Messages
        'Merry Christmas!',
        'Happy holidays!',
        'Wishing you joy and peace.',
        'Warm holiday wishes.',
        'Sending festive cheer.',
        'Season’s greetings!',
        'Have a wonderful Christmas.',
        'Joy to you and yours.',
        'Peace, love, and joy.',
        'Cheers to the season.',

        // Pet-Themed Christmas Card Messages
        'Wishing you a paws-itively Merry Christmas!',
        'Meowy Christmas and Happy Howl-idays!',
        'Hope your holidays are filled with wagging tails and cozy cuddles.',
        'Santa Paws is coming to town.',
        'Fleece Navidad from our furry family to yours.',
        'Sending holiday purrs and tail wags.',
        'May your Christmas be furry and bright.',
        'Happy holidays from our four-legged family members.',
        'Paws and enjoy the holiday season.',
        'From our home to yours, Merry Christmas—woofs and all.',

        // Christmas Wishes for Family & Friends
        'Wishing you all the love and warmth this Christmas.',
        'Grateful for family like you this holiday season.',
        'Merry Christmas to my favorite people—love you always.',
        'Home is wherever family is. Merry Christmas!',
        'Hoping your holiday is filled with everything that makes you smile.',
        'Sending hugs, love, and holiday cheer.',
        'Celebrating the season with gratitude for friends like you.',
        'Wishing you a holiday full of family, fun, and good food.',
        'Merry Christmas to the ones who make life brighter all year.',
        'So lucky to call you family. Merry Christmas!',

        // Business Holiday Card Greetings
        'Wishing you a happy holiday season and a successful New Year.',
        'Thank you for your partnership this year. Happy holidays!',
        'Sending warm holiday wishes from our team to yours.',
        'Grateful for your support—looking forward to working together in the New Year.',
        'Season’s greetings and best wishes for continued success.',
        'Cheers to a joyful holiday season and a prosperous year ahead.',
        'Wishing you peace, joy, and good health this holiday season.',
        'Happy holidays from all of us at [Your Company Name].',
        'Thank you for a great year. Wishing you happiness and success in the coming year.',
        'Looking forward to new opportunities in the New Year. Happy holidays!',

        // Sentimental Christmas Card Sayings
        'Wishing you a holiday season filled with love, peace, and beautiful memories.',
        'The best gifts aren’t wrapped in paper but shared from the heart. Merry Christmas.',
        'Thinking of you this Christmas and sending love across the miles.',
        'May your holidays be filled with all the little things that make life special.',
        'Hoping this Christmas brings you comfort, joy, and lasting happiness.',
        'Grateful for your presence in my life this holiday season and always.',
        'Wishing you quiet moments, warm gatherings, and lasting joy.',
        'Celebrating the season with thoughts of love and appreciation for you.',
        'Here’s to cherished memories and new traditions this Christmas.',
        'Sending you heartfelt wishes for a peaceful and meaningful holiday.',

        // Romantic Christmas Card Messages
        'You make every season brighter. Merry Christmas, my love.',
        'All I want for Christmas is you.',
        'Wishing you a Christmas filled with love, laughter, and everything that makes life beautiful.',
        'My favorite part of the holidays is sharing them with you.',
        'Christmas feels magical because I get to spend it with you.',
        'To the one who makes my heart feel merry and bright—Merry Christmas!',
        'I’m grateful for every moment with you this season and always.',
        'Here’s to cozy nights, festive lights, and sharing it all with you.',
        'Sending all my love this Christmas and into the New Year.',
        'Love is the greatest gift of all—Merry Christmas, darling!',
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

    if (christmasBtn) {
        christmasBtn.addEventListener('click', () => {
            const christmasText =
                christmasTexts[Math.floor(Math.random() * christmasTexts.length)];
            if (textInput) {
                textInput.value = christmasText;
            }
            void sendText('christmas');
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

