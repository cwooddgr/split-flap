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

    // --- Holiday detection helpers ---

    function getEasterDate(year) {
        const a = year % 19;
        const b = Math.floor(year / 100);
        const c = year % 100;
        const d = Math.floor(b / 4);
        const e = b % 4;
        const f = Math.floor((b + 8) / 25);
        const g = Math.floor((b - f + 1) / 3);
        const h = (19 * a + b - d - g + 15) % 30;
        const i = Math.floor(c / 4);
        const k = c % 4;
        const l = (32 + 2 * e + 2 * i - h - k) % 7;
        const m = Math.floor((a + 11 * h + 22 * l) / 451);
        const month = Math.floor((h + l - 7 * m + 114) / 31);
        const day = ((h + l - 7 * m + 114) % 31) + 1;
        return new Date(year, month - 1, day);
    }

    function getNthWeekdayOfMonth(year, month, weekday, n) {
        const first = new Date(year, month, 1);
        let day = 1 + ((weekday - first.getDay() + 7) % 7);
        day += (n - 1) * 7;
        return new Date(year, month, day);
    }

    function getNextHoliday() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const holidays = [];
        for (const year of [today.getFullYear(), today.getFullYear() + 1]) {
            holidays.push(
                { key: 'newyears', name: "New Year's", date: new Date(year, 0, 1) },
                { key: 'valentines', name: "Valentine's Day", date: new Date(year, 1, 14) },
                { key: 'stpatricks', name: "St. Patrick's Day", date: new Date(year, 2, 17) },
                { key: 'easter', name: 'Easter', date: getEasterDate(year) },
                { key: 'aprilfools', name: "April Fool's Day", date: new Date(year, 3, 1) },
                { key: 'mothers', name: "Mother's Day", date: getNthWeekdayOfMonth(year, 4, 0, 2) },
                { key: 'fathers', name: "Father's Day", date: getNthWeekdayOfMonth(year, 5, 0, 3) },
                { key: 'independence', name: 'Independence Day', date: new Date(year, 6, 4) },
                { key: 'labor', name: 'Labor Day', date: getNthWeekdayOfMonth(year, 8, 1, 1) },
                { key: 'halloween', name: 'Halloween', date: new Date(year, 9, 31) },
                { key: 'thanksgiving', name: 'Thanksgiving', date: getNthWeekdayOfMonth(year, 10, 4, 4) },
                { key: 'christmas', name: 'Christmas', date: new Date(year, 11, 25) },
            );
        }

        let closest = null;
        for (const h of holidays) {
            h.date.setHours(0, 0, 0, 0);
            const diff = Math.round((h.date - today) / (1000 * 60 * 60 * 24));
            if (diff >= 0 && diff <= 30) {
                if (!closest || diff < closest.daysUntil) {
                    closest = { key: h.key, name: h.name, daysUntil: diff };
                }
            }
        }
        return closest;
    }

    // --- Lazy-loaded quotes ---

    let quotesPromise = null;

    function loadQuotes() {
        if (!quotesPromise) {
            quotesPromise = fetch('quotes.json').then(r => r.json());
        }
        return quotesPromise;
    }

    // --- Firestore write ---

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

    // --- Button handlers ---

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
        randomBtn.addEventListener('click', async () => {
            const q = await loadQuotes();
            const randomText = q.random[Math.floor(Math.random() * q.random.length)];
            if (textInput) {
                textInput.value = randomText;
            }
            void sendText('random');
        });
    }

    const activeHoliday = getNextHoliday();

    if (funnyBtn) {
        let quoteSource, quoteKey;
        if (activeHoliday && activeHoliday.key) {
            funnyBtn.textContent = activeHoliday.name + ' Quote';
            quoteSource = activeHoliday.key;
            quoteKey = activeHoliday.key;
        } else {
            quoteSource = 'funny';
            quoteKey = null;
        }
        funnyBtn.addEventListener('click', async () => {
            const q = await loadQuotes();
            const pool = (quoteKey && q.holiday[quoteKey]) || q.funny;
            const quote = pool[Math.floor(Math.random() * pool.length)];
            if (textInput) {
                textInput.value = quote;
            }
            void sendText(quoteSource);
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

})();
