# CLAUDE.md

**Flip Flap** (repo name Split-Flap): a minimalist split-flap message board. A display (web `web/index.html`, or the tvOS app in `tvos/SplitFlapTV/`) makes a random `roomId`, shows a QR code to the remote (`web/control.html`), and animates tiles when the remote writes to `rooms/{roomId}` in Firestore. Public repo, `main` only. Tier 2 on dgrlabs.co, still treated as production (free tvOS app on the App Store; web at `flipflap.dgrlabs.co`). ASC app id `6761391738`, bundle id `co.dgrlabs.flipflap`, team `2CTUXD4C44`, tvOS 17.0+.

**Status: tvOS 1.2 (build 3; tag `tvos-1.2-3`) live since 2026-09-21; nothing in review.** Replace this line at each submission and outcome; history goes in `docs/status.md`.

## Docs map

| Topic | File |
|---|---|
| Status narrative, what each version holds | `docs/status.md` |
| Architecture, key files, board sizes, layout algorithm, animation design | `docs/architecture.md` |
| Firestore document shape, Firebase setup, API keys, security rules | `docs/firebase.md` |
| Canonical Firestore protocol | `docs/PROTOCOL.md` |
| tvOS release steps, submission permission, web deploy | `docs/release.md` |
| September 2026 audit and plan (read before touching connection code, rules, or layout ports) | `docs/AUDIT_2026-09.md` |
| App Store listing copy and What's New | `APP_STORE_LISTING.md` |

## Commands

```bash
python -m http.server 8000 -d web          # web app, no build step; still signs in to production Firebase
open tvos/SplitFlapTV/SplitFlapTV.xcodeproj   # tvOS; GoogleService-Info.plist is tracked; Firebase via SwiftPM
node --test tests/layout.test.mjs          # layout fixtures, JS port
cd tvos && swift test                      # layout fixtures, Swift port
python3 tests/rules_test.py                # Firestore rules, before deploying them
firebase deploy --only firestore:rules     # project from .firebaserc
cd tests && npm install && node listener_check.mjs --strict   # after a rules deploy; against production
```

Web deploy: `.github/workflows/pages.yml` publishes `web/`, and only `web/`, on every push to `main` that touches it. Version numbers live only in `tvos/SplitFlapTV/Version.xcconfig`.

## Architecture in brief

- Web: static ES modules in `web/`, Firebase SDK from Google's CDN, no other CDN (QR code is vendored). Grid 21×6. The remote uses Firestore Lite; the display uses the full SDK with forced long polling.
- tvOS: SwiftUI, grid 21×8, one `Canvas` of cached glyph halves driven by one animation coordinator; `RoomViewModel.swift` mirrors `web/display.js`.
- Both share one layout algorithm (two hand ports held together by `shared/layout-fixtures.json`) and one 73-character charset.
- `firestore.rules` at the repo root is the rules source of truth; don't copy the rules into docs.

## Rules that have bitten us

- `web/control.html` keeps its name and place: the shipped tvOS app hardcodes `https://flipflap.dgrlabs.co/control.html`. Anything not meant to be public stays out of `web/`.
- To change layout behavior, change or add a fixture first, then make both ports pass.
- Don't undo the single animation coordinator or the single `Canvas` on tvOS without new measurements (A10X, July 2026).
- The web Firebase key must allow Firestore, Identity Toolkit, and `securetoken.googleapis.com`; never restrict it to fewer (missing securetoken broke every web token refresh until 2026-09-20). Check the key's API list and the rules before re-adding any "connection" scaffolding. Details in `docs/firebase.md`.
- Never delete the Firebase key named "iOS key": the shipped tvOS app uses it (since 2026-02-14).
- Don't go back to `getFirestore(app)` on the web display without re-testing in Safari (WebKit stream buffering, 2026-09-20).
- Anything added to the document shape goes into `firestore.rules` first, or the remote's write is refused silently. No client deletes rooms (TTL does).
- A message with more lines than the board has rows loses them silently; the remote doesn't know which board it writes to.
- `AutoTestDriver` (Debug, `-AutoTest` launch argument) writes to the production Firestore project.

## Settled: don't propose changing (decided-by-user)

The QR code stays up until the user hides it, on web and tvOS; no auto-hide (2026-09-20). The remote uses Firestore Lite with no offline queue: a send with no connection fails at once (2026-09-20, "1b"). The web display forces long polling (2026-09-20). The web API key has no HTTP referrer restriction (2026-09-19). "Always Use HTTPS" is on for the whole dgrlabs.co zone (2026-09-20). Rationale for each is in `docs/architecture.md`, `docs/firebase.md`, and `docs/release.md`.

## Releases

- **Who submits**: per the workspace `CLAUDE.md` standing permission (2026-09-21); here the app is Flip Flap and the version is the one the session has been preparing. Steps in `docs/release.md`.
- Before any submission, read `../APP_STORE_REJECTIONS.md` and `../APP_STORE_RELEASE.md`.
- Read state with `node ../otd/scripts/asc.mjs GET "/v1/apps/6761391738/appStoreVersions?limit=3"`; older versions also read `READY_FOR_SALE`, so the newest one with that state is the live one. Never answer "is it live" from notes.
- A rejection goes in `../APP_STORE_REJECTIONS.md` and is never resubmitted unasked.
- Build numbers are per version on tvOS, but pick one no earlier build has used. A new version doesn't inherit promotional text; copy it over.
- Flip Flap is not on supportbot's list and has no release-sync routine.
