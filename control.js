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
        // New quotes added below
        'THE ONLY WAY TO DO\nGREAT WORK IS TO\nLOVE WHAT YOU DO',
        'DIFFICULT ROADS\nOFTEN LEAD TO\nBEAUTIFUL\nDESTINATIONS',
        'YOUR ONLY LIMIT\nIS YOUR MIND',
        'MAKE TODAY SO\nAWESOME THAT\nYESTERDAY GETS\nJEALOUS',
        'STARS CANNOT SHINE\nWITHOUT DARKNESS',
        'FALL SEVEN TIMES\nSTAND UP EIGHT',
        'WHAT YOU DO TODAY\nCAN IMPROVE ALL\nYOUR TOMORROWS',
        'BELIEVE YOU CAN\nAND YOU ARE\nHALFWAY THERE',
        'SUCCESS IS NOT\nFINAL\nFAILURE IS NOT\nFATAL',
        'THE SECRET OF\nGETTING AHEAD IS\nGETTING STARTED',
        'STAY HUNGRY\nSTAY FOOLISH',
        'TURN YOUR WOUNDS\nINTO WISDOM',
        'ACTION IS THE\nFOUNDATIONAL KEY\nTO ALL SUCCESS',
        'WHAT LIES BEHIND US\nAND BEFORE US ARE\nTINY MATTERS',
        'IN THE MIDDLE OF\nDIFFICULTY LIES\nOPPORTUNITY',
        'FORTUNE FAVORS\nTHE BOLD',
        'WELL DONE IS\nBETTER THAN\nWELL SAID',
        'THE HARDER YOU\nWORK THE LUCKIER\nYOU GET',
        'DOUBT KILLS MORE\nDREAMS THAN\nFAILURE EVER WILL',
        'SIMPLICITY IS THE\nULTIMATE\nSOPHISTICATION',
        'YOUR VIBE ATTRACTS\nYOUR TRIBE',
        'PROGRESS NOT\nPERFECTION',
        'HUSTLE IN SILENCE\nLET SUCCESS MAKE\nTHE NOISE',
        'PROVE THEM WRONG',
        'GOOD THINGS TAKE\nTIME',
        'NOT ALL WHO WANDER\nARE LOST',
        'CREATE THE LIFE\nYOU CANNOT WAIT\nTO WAKE UP TO',
        'BE FEARLESS IN THE\nPURSUIT OF WHAT\nSETS YOUR SOUL\nON FIRE',
        'COLLECT MOMENTS\nNOT THINGS',
        'ESCAPE THE\nORDINARY',
        'STAY CLOSE TO\nPEOPLE WHO FEEL\nLIKE SUNSHINE',
        'WHEREVER YOU GO\nGO WITH ALL\nYOUR HEART',
        'TAKE THE RISK OR\nLOSE THE CHANCE',
        'INHALE COURAGE\nEXHALE FEAR',
        'TALK LESS\nDO MORE',
        'WAKE UP WITH\nDETERMINATION\nGO TO BED WITH\nSATISFACTION',
        'LEARN FROM\nYESTERDAY\nLIVE FOR TODAY\nHOPE FOR TOMORROW',
        'YOU DID NOT COME\nTHIS FAR TO ONLY\nCOME THIS FAR',
        'SMALL STEPS EVERY\nDAY',
        'RISE ABOVE THE\nSTORM AND YOU WILL\nFIND THE SUNSHINE',
        'LIFE BEGINS AT THE\nEND OF YOUR\nCOMFORT ZONE',
        'THE BEST TIME TO\nPLANT A TREE WAS\n20 YEARS AGO.\nTHE SECOND BEST\nTIME IS NOW',
        'BLOOM WHERE YOU\nARE PLANTED',
        'MAKE IT HAPPEN',
        'ADVENTURES FILL\nYOUR SOUL',
        'FIND JOY IN THE\nJOURNEY',
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
        // New funny quotes added below
        'I FINALLY GOT\n8 HOURS OF SLEEP\nIT TOOK ME\n3 DAYS BUT STILL',
        "MY DIET PLAN:\nMAKE ALL MY\nFRIENDS CUPCAKES\nTHE FATTER THEY\nGET THE THINNER\nI LOOK",
        "I'M NOT SAYING\nI HATE YOU BUT\nI WOULD UNPLUG\nYOUR LIFE SUPPORT\nTO CHARGE MY PHONE",
        'NAMASTE IN BED',
        "I'M SORRY I\nOFFENDED YOU WITH\nMY COMMON SENSE",
        'MY ALONE TIME IS\nFOR YOUR SAFETY',
        "I'M MULTITASKING:\nI CAN LISTEN\nIGNORE AND FORGET\nALL AT ONCE",
        'OF COURSE I TALK\nTO MYSELF\nSOMETIMES I NEED\nEXPERT ADVICE',
        "I'M NOT CLUMSY\nTHE FLOOR JUST\nHATES ME\nTABLES AND CHAIRS\nARE BULLIES\nAND WALLS GET IN\nMY WAY",
        'MY COOKING IS SO\nBAD MY SMOKE\nDETECTOR CHEERS\nME ON',
        'I HAVE A LOT OF\nJOKES ABOUT\nUNEMPLOYED PEOPLE\nBUT NONE OF THEM\nWORK',
        'THEY SAY NOTHING\nIS IMPOSSIBLE\nBUT I DO NOTHING\nEVERY DAY',
        "I'M NOT GREAT AT\nADVICE\nCAN I INTEREST YOU\nIN A SARCASTIC\nCOMMENT",
        "I'D AGREE WITH YOU\nBUT THEN WE'D\nBOTH BE WRONG",
        'SOMETIMES I DRINK\nWATER JUST TO\nSURPRISE MY LIVER',
        "I'M NOT SAYING\nI'M BATMAN\nI'M JUST SAYING\nNO ONE HAS EVER\nSEEN ME AND BATMAN\nIN A ROOM TOGETHER",
        "A CLEAN HOUSE IS\nA SIGN OF A\nBROKEN WIFI",
        "I DON'T HAVE\nDUCKS OR ROWS\nI HAVE SQUIRRELS\nAND THEY ARE\nEVERYWHERE",
        'SURE I DO\nMARATHONS\nON NETFLIX',
        "I'M SORRY\nI DIDN'T MEAN TO\nPUSH ALL YOUR\nBUTTONS\nI WAS LOOKING FOR\nMUTE",
        "JUST ONCE I'D LIKE\nA USERNAME AND\nPASSWORD PROMPT TO\nSAY: CLOSE ENOUGH",
        'RELATIONSHIP\nSTATUS:\nLOOKING FOR WIFI',
        'MY THERAPIST\nSAYS I HAVE A\nPREOCCUPATION WITH\nVENGEANCE\nWE WILL SEE\nABOUT THAT',
        'TOLD MY SUITCASE\nWE ARE NOT GOING\nON VACATION\nNOW I AM DEALING\nWITH EMOTIONAL\nBAGGAGE',
        "I'M AT THAT AGE\nWHERE MY BACK GOES\nOUT MORE THAN I DO",
        'A BALANCED DIET\nIS CHOCOLATE IN\nBOTH HANDS',
        "I DIDN'T FALL\nI DID ATTACK THE\nFLOOR THOUGH",
        'I USED TO THINK\nI WAS INDECISIVE\nBUT NOW I AM NOT\nSO SURE',
        "I'LL BE READY\nIN FIVE MINUTES\nDO NOT CALL ME\nFOR 30 MINUTES",
        'MY WINDOWS ARE\nNOT DIRTY\nTHAT IS MY DOG\nNOSE ART',
        'I FINALLY\nREALIZED THAT\nPEOPLE ARE\nPRISONERS OF\nTHEIR PHONES\nTHAT IS WHY THEY\nARE CALLED CELLS',
        'SOMETIMES I FEEL\nUGLY BUT THEN I\nLOOK AT MY BROTHER\nAND I FEEL OKAY',
        "I'M ON THAT NEW\nDIET WHERE YOU\nEAT EVERYTHING\nAND PRAY FOR A\nMIRACLE",
        'THE BAGS UNDER MY\nEYES ARE DESIGNER',
        'I SPEAK FLUENT\nSARCASM',
        "I'M NOT LAZY\nI JUST REALLY\nENJOY DOING\nNOTHING",
        'ACCORDING TO MY\nMIRROR I AM\nPREGNANT\nTHE FATHER IS\nNUTELLA',
        "TODAY'S MOOD:\nHANDLE WITH CARE\nOR NOT AT ALL",
        "SORRY I'M LATE\nI DIDN'T WANT\nTO COME",
        'MAY YOUR COFFEE\nBE STRONGER THAN\nYOUR TODDLER',
        "I DIDN'T CHOOSE\nTHE MUG LIFE\nTHE MUG LIFE\nCHOSE ME",
        'WHEN LIFE GIVES\nYOU LEMONS\nSQUIRT SOMEONE\nIN THE EYE',
        'MY BLOOD TYPE IS\nCOFFEE',
        "JUST BURNED 2000\nCALORIES\nTHAT'S THE LAST\nTIME I LEAVE\nBROWNIES IN THE\nOVEN",
        'IS THERE A COFFEE\nTHAT LETS ME KEEP\nMY PERSONALITY\nBUT ALSO MAKES ME\nA MORNING PERSON',
        'I NEED A NEW\nFRIEND\nTHE LAST ONE\nESCAPED',
        "I'M OUTDOORSY\nIN THAT I LIKE\nGETTING DRUNK ON\nPATIOS",
        'MY FAVORITE\nOUTDOOR ACTIVITY\nIS GOING BACK\nINSIDE',
        'PEOPLE SAY\nNOTHING IS\nIMPOSSIBLE BUT I\nDO NOTHING EVERY\nDAY',
        'LIFE UPDATE:\nCURRENTLY HOLDING\nIT ALL TOGETHER\nWITH ONE BOBBY PIN',
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

