# Firebase

> **Author:** Claude Code (coder) · **Date:** 2026-09-26 · **Status:** moved verbatim from `CLAUDE.md` when it was slimmed (decided-by-user 2026-09-26); provenance stamps inside the text are the originals.

## Firestore Document Shape

```jsonc
// Collection: rooms, Document: {roomId}
{
  "text": "MESSAGE HERE",           // required - raw text with \n for newlines
  "source": "manual",               // optional - "manual" | "random" | "funny" | "clear" | a holiday key
  "updatedAt": "<serverTimestamp>", // optional - for debugging
  "expiresAt": "<timestamp>"        // optional - TTL cleanup (7 days)
}
```

`source` is whatever `control.js` passes to `sendText`. Near a holiday the Funny Quote button sends that holiday's key instead of `"funny"` (`newyears`, `valentines`, `stpatricks`, `easter`, `aprilfools`, `mothers`, `memorial`, `fathers`, `independence`, `labor`, `halloween`, `veterans`, `thanksgiving`, `christmas`). Displays ignore the field. Only the web remote writes in release builds; neither display ever creates or writes the room document.

## Firebase Requirements

- **Cloud Firestore** enabled (Native mode)
- **Anonymous authentication** enabled
- **Authorized domains** configured (Firebase Console → Authentication → Settings → Authorized domains)
- **API keys** (verified with `gcloud services api-keys list`, 2026-09-19): the web key in `firebase-init.js` is the "Browser key", limited to the Firestore and Identity Toolkit APIs with no HTTP referrer restriction (left that way, decided-by-user 2026-09-19). **Fixed 2026-09-20 (decided-by-user): the key now also allows `securetoken.googleapis.com`**, and a test refresh with the web key returned 200. Until then the list was a defect, not hardening (found 2026-09-19): it left out `securetoken.googleapis.com` (Token Service API), which Firebase Auth uses to refresh ID tokens, so every web refresh failed (45 of 45 requests with this key returned 403 in the 41 days to 2026-09-19, against 269 of 269 returning 200 for the tvOS app's key). Web auth died about an hour after page load, and the health-check, 403-interceptor, and force-reauth code in `display.js` recovered by creating a new anonymous user; `control.js` had no recovery. The soak read clean on 2026-09-20 (a display tab open for two hours refreshed at 55 and 110 minutes, 200 each time, no 403 and no new sign-up beside either), and that scaffolding was deleted the same day: `display.js` keeps one listener and resubscribes with backoff only if it errors, and nothing in the web app signs out. Don't bring any of it back for a "connection" problem without first checking the key's API list and the rules (see `docs/AUDIT_2026-09.md`). Never restrict this key to fewer than those three APIs. The shipped tvOS app uses the key Firebase named "iOS key" (Firebase registers a tvOS app as an iOS app); it has been in `GoogleService-Info.plist` since 2026-02-14, before 1.0 shipped, so never delete it. The key named "tvOS key" is the one with the `co.dgrlabs.flipflap` bundle restriction, but no shipped build uses it (0 requests in the 42 days to 2026-09-19).
- Web config in `firebase-core.js`, tvOS config via `GoogleService-Info.plist`
- **The web display forces Firestore long polling** (`initializeFirestore(app, { experimentalForceLongPolling: true })`, decided-by-user 2026-09-20). Since Safari 26.4 WebKit holds the last frame of a streamed response until more data arrives, so with the default connection a display in Safari showed each message only when the next one was sent (firebase-js-sdk issue #9789; measured here in Safari 27.0: 2 of 6 writes on time with the default, 6 of 6 with long polling). Don't go back to `getFirestore(app)` without repeating that test in Safari, even after Apple ships a fix

### Firestore Security Rules

The rules live in `firestore.rules` at the repo root; that file is the source of truth, so don't copy them into docs (a copy here drifted from the deployed rules between 2025-12 and 2026-09). Deploy with:

```bash
firebase deploy --only firestore:rules   # project comes from .firebaserc
```

The `rooms` collection must be explicitly allowed. Without this, real-time `onSnapshot` listeners will fail silently.

Key points:
- `request.auth != null` allows anonymous auth (used by both web and tvOS)
- Reads are `allow get` only, so nobody can query the collection. An earlier version of this file said `onSnapshot()` needs `read` and not `get`; that was folklore. Firebase's rules docs say `get` applies to single-document reads and `list` to queries, and a single-document listener is a `get`. **Deployed 2026-09-20 at 17:26 UTC** (Charlie ran the deploy; the live ruleset matched `firestore.rules` byte for byte). `listener_check.mjs --strict` passed right after, which is the live proof that a single-document listener works under `get`: the listener delivered a server-confirmed write, and a collection query, an extra field, a missing `expiresAt`, and a 1,001-character `text` were each refused. The previous, looser rules are in commit `6a39f00` if a rollback is ever needed
- Room IDs must match `^[A-Z0-9]{4,12}$` (both clients generate 6–8 characters)
- A write is judged on the whole document after the merge: only `text`, `source`, `updatedAt`, and `expiresAt` may exist; `text` is a string of at most 1,000 characters (the remote's textarea has the same `maxlength`); `expiresAt` is required, a timestamp, and less than 30 days out (the remote sends the phone's clock plus 7 days); `source` is a string of at most 32 characters; `updatedAt` is a timestamp. Anything a client adds to the document shape has to be added to the rules first, or the write is refused without any message in the remote's UI
- Test before deploying: `python3 tests/rules_test.py` runs a table of allow and deny cases through Google's stateless rules-test API (no emulator, no Java, touches no data). After deploying: `cd tests && npm install && node listener_check.mjs --strict` runs the real SDK against production (sign in, listen, write, and check the forbidden writes are refused); it prints a uid and room to delete afterwards
- No client deletes rooms. The `expiresAt` TTL policy removes them server-side, so delete is denied
