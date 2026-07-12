# Signal — Emergency Response Mapping (Firebase edition)

This version replaces the earlier Python/SQLite backend with **Firebase**:
Firestore as the live database, Firebase Auth for staff sign-in, and
Firebase Storage for photos. There is no server to run anymore — every
page talks to Firebase directly. You just need a static file server to
serve the HTML/JS files (or you can use Firebase Hosting itself).

## 1. Create your Firebase project

1. Go to https://console.firebase.google.com/ and click **Add project**.
   Name it whatever you like (e.g. "signal-jimeta").
2. Once created, click the **</>** (web app) icon to register a web app.
   You don't need Firebase Hosting for this step — just register the app
   and it'll show you a `firebaseConfig` object.
3. Copy that config and paste it into `firebase-init.js`, replacing every
   `"REPLACE_ME"` value.

## 2. Enable the Firebase products this app uses

In the left sidebar of the Firebase console:

- **Authentication** → Sign-in method → enable:
  - **Email/Password** (for dispatchers and responders)
  - **Anonymous** (used silently for citizens submitting reports — they
    never see a login screen, this just gives Firestore's security rules
    something to check against)
- **Firestore Database** → Create database → start in **production mode**
  (not test mode) → pick a region close to Nigeria if offered (e.g.
  `europe-west1`) → once created, go to the **Rules** tab and replace the
  default rules with the contents of `firestore.rules` in this folder →
  **Publish**.
- **Storage** → Get started → same idea: once created, go to **Rules**
  and paste in `storage.rules` → **Publish**.

## 3. Create your first dispatcher and responder accounts

There's no sign-up page by design — staff accounts are provisioned by an
admin (you) directly in the console, not self-served. For each person:

**a) Create the login**
Authentication → Users → Add user → enter their email and a password.
Copy the **User UID** it generates — you'll need it next.

**b) Give them a role**
Firestore Database → Data → Start collection → collection ID `staff` →
document ID = paste the **User UID** from step (a) → add these fields:

For a **dispatcher**:
| Field | Type | Value |
|---|---|---|
| role | string | `dispatcher` |
| name | string | e.g. `W. Audi` |

For a **responder**, you also need a matching entry in a `responders`
collection first:

Firestore Database → Data → Start collection → collection ID `responders`
→ auto-ID → fields:
| Field | Type | Value |
|---|---|---|
| name | string | e.g. `Unit 4 — Aliyu B.` |
| status | string | `available` |
| currentReportId | null | (leave null) |

Copy that new responder document's ID, then in the matching `/staff/{uid}`
doc for that person add:
| Field | Type | Value |
|---|---|---|
| role | string | `responder` |
| name | string | e.g. `Aliyu B.` |
| responderId | string | (the responder doc ID you just copied) |

Repeat for as many responders as you want to test with. This is manual by
design — you asked for console-based account creation rather than a seed
script, so this is the one-time setup per staff member.

## 4. Run it locally

Since there's no backend anymore, any static file server works. From this
folder:

```bash
python3 -m http.server 8000
```

or, in VS Code, right-click `signal-landing.html` → "Open with Live
Server" (if you have that extension) — either works, since it's all
static files talking to Firebase over the network.

Then open `http://127.0.0.1:8000/signal-landing.html`.

- **Citizens** → "Report an incident" → `signal-report-form.html` (no
  login needed)
- **Staff** → "Staff sign-in" → `signal-login.html` → routes automatically
  to `signal-dashboard.html` (dispatcher) or `signal-responder.html`
  (responder) based on their role

## 5. Run the tests

```bash
node --test test_utils.mjs
```

This covers the pure logic — the haversine distance calculation and
nearest-responder selection, dispatch-time mapping, and input validation.
It does **not** hit Firebase (no live project needed to run these).
Anything Firestore-dependent (the actual reads/writes) is not covered by
automated tests in this build — see "What's not covered" below.

## What's new in this pass

**1. Real authentication.** Dispatchers and responders sign in with
email/password via Firebase Auth. The dashboard and responder page both
check the signed-in user's role (stored in `/staff/{uid}`) before showing
anything, and redirect to login otherwise. Citizens still need no account
to report an incident — they're silently signed in anonymously so
Firestore's rules have something to check.

**2. Real-time updates, no more polling.** The dashboard, responder page,
and tracking page all use Firestore's `onSnapshot` listeners. A status
change made by a dispatcher appears on the citizen's tracking page (and a
responder's phone) within about a second, over a live connection — not on
a 4-second timer like the previous polling version.

**3. Real responder location tracking — not simulated.** This is the big
one from last time's gap list. `signal-responder.html` is a new page: a
signed-in responder can toggle "Share my location," which uses
`navigator.geolocation.watchPosition` to continuously write their real
GPS position to their `/responders/{id}` document (throttled to roughly
once every 8 seconds to avoid hammering Firestore). The citizen's tracking
page listens to that same document live. If a responder hasn't turned
sharing on, the tracking page says so honestly ("waiting for them to
enable location sharing") instead of faking a position.

**4. Distance-based nearest-responder assignment.** `dispatch.js` computes
the real great-circle (haversine) distance from the incident to every
available responder's last known location and assigns the closest one —
not just whoever happens to be first in the list. It's wrapped in a
Firestore transaction with a retry loop so two reports created at nearly
the same moment can't both grab the same responder.

**5. Input validation, both client and server-enforced.** `utils.js` has
a `validateReportInput()` function used client-side for fast feedback, and
— more importantly — `firestore.rules` independently re-checks the same
constraints server-side (required fields, urgency must be one of three
values, max 3 photos) so a modified or malicious client can't bypass
validation just by skipping the JS.

**6. An audit trail.** Every report creation, status change, and
responder assignment writes an entry to an `audit_log` collection
(reportId, action, actor, timestamp, details). The dashboard has a new
"Activity log" tab showing the last 50 events. Entries are append-only —
security rules block edits/deletes — so the trail can't be quietly altered
later.

**7. Offline-tolerant submission, essentially for free.** Firestore's SDK
has built-in offline persistence (enabled in `firebase-init.js` via
`enableIndexedDbPersistence`). If a citizen loses signal while submitting
a report, the write is queued locally and syncs automatically the moment
connectivity returns — no custom retry logic needed.

**8. Small accessibility improvements.** `aria-live` regions on the
tracking page so status changes are announced to screen readers, proper
`alt` text on all photos, and keyboard-operable modal closing (Escape key,
backdrop click) carried over from the previous version.

**9. Unit tests for the actual logic that matters.** `test_utils.mjs`
tests the haversine distance math and nearest-responder selection — the
core "does this system actually route to the closest responder" claim —
independent of any live Firebase project, using Node's built-in test
runner.

## Honest limitations — what's still not solved

- **No real rate-limiting / abuse protection.** Firestore security rules
  stop a browser from writing malformed data or acting outside its role,
  but they don't stop someone from writing a script that calls
  `signInAnonymously` in a loop and floods fake reports. Solving this
  properly needs **Firebase App Check** (reCAPTCHA-backed, free tier
  available) or moving report creation behind a Cloud Function — both are
  reasonable next steps, but Cloud Functions require Firebase's paid
  "Blaze" plan (pay-as-you-go, has a generous free tier, but does need a
  billing account attached), so I didn't wire that in without you
  deciding you want that tradeoff.
- **Nearest-responder assignment isn't fully atomic against every race
  condition.** The transaction-with-retry approach in `dispatch.js`
  handles the common case (two reports created seconds apart), but a
  fully bulletproof version would run this logic in a Cloud Function
  instead of the reporting citizen's own browser. Same Blaze-plan tradeoff
  as above.
- **No SMS or push notifications.** If someone closes the tracking page
  tab, they get nothing further — there's no fallback channel. Adding
  real SMS (e.g. via Africa's Talking or Termii, both used widely in
  Nigeria) needs a paid account with one of those providers plus a small
  Cloud Function to trigger sends on status change — that's real
  third-party account setup only you can do, but I'm glad to wire in the
  code once you have credentials.
- **Photos are publicly readable by URL** once uploaded (see
  `storage.rules` — `allow read: if true`). This is intentional so the
  citizen tracking page (which citizens access without a real login) can
  display them, but it does mean anyone with a direct photo URL could view
  it without authentication. Worth reconsidering if photos could contain
  sensitive content.
- **Firestore-dependent code has no automated tests.** `test_utils.mjs`
  covers the pure math and validation, but the actual database
  reads/writes (`dispatch.js`'s Firestore calls, the dashboard's
  `onSnapshot` wiring) aren't covered — that would need the Firebase
  Local Emulator Suite wired into a test harness, which is a reasonable
  next step if you want full test coverage.
- **The old Python backend (`server.py`) and its test suite are gone** in
  this version — this is now a 100% static-file + Firebase app. If you
  need the old version for comparison, it's in the earlier zip I sent
  you.

## File map

- `firebase-init.js` — Firebase app setup (put your project config here)
- `utils.js` — pure, unit-tested helper functions (distance math, status
  copy, validation, formatting)
- `dispatch.js` — Firestore-dependent nearest-responder assignment logic
- `firestore.rules` / `storage.rules` — paste into the Firebase console
- `signal-landing.html` — marketing/overview page
- `signal-report-form.html` — citizen incident report form (GPS + photos)
- `signal-login.html` — staff sign-in (dispatcher/responder)
- `signal-dashboard.html` — dispatcher view (live reports, map, responders,
  activity log)
- `signal-responder.html` — responder view (share live location, manage
  their assigned report)
- `signal-track.html` — citizen tracking page (real-time status + live
  responder position, once shared)
- `test_utils.mjs` — unit tests (`node --test test_utils.mjs`)
