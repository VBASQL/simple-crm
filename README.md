# Call-Driven CRM (Globalex webhook)

A lightweight, multi-tenant CRM that builds customer records and tickets from
Globalex PBX webhooks (and, later, forwarded email), with a live pop-up when a
call comes in. It never touches the calls themselves — Globalex handles
telephony; this system only listens.

## Repo layout

```
docs/
  globalex-webhook.md   The binding external contract (fields, events, template).
  build-plan.md         Condensed product/build plan.
functions/              Firebase Cloud Functions (TypeScript, strict).
  src/app/              Composition roots: HTTP handlers, jobs, the container.
  src/domain/           Pure business logic (no Firebase, no I/O).
  src/infra/            Adapters that implement the domain ports.
  src/shared/           Errors, Result, Zod schemas, phone/time utils.
  src/test/             Fakes for every port + fixtures.
web/                    React agent SPA (Vite + TS): sign-in, calls log,
                        customer page, and the live incoming-call pop-up.
firestore.rules         Multi-tenant security rules.
CLAUDE.md               Binding engineering rules for this repo.
```

Import direction is one-way: `app → domain ← infra`. See `CLAUDE.md` for the
full, binding conventions (DI, error handling, logging, testing).

## What's in this first cut

- Project scaffold: strict TypeScript, ESLint with enforced import boundaries,
  Vitest.
- The Globalex payload **contract** as a Zod schema, with fixtures per event.
- Domain core: `PhoneNormalizer`, `CallStateMachine`, `TicketPolicy`,
  `CustomerService`, `TicketService`, and `CallService` — the webhook pipeline
  (`ring → answer → hangup → cdr → dtmf`) wired end-to-end against in-memory
  fakes and unit-tested (happy path, idempotent repeat, unknown-DID drop,
  out-of-order drop, voicemail detection).
- Firestore adapters for every port and the `globalexWebhook` Cloud Function
  composition root (auth → validate → ack → one service call → one log line).
- Firestore security rules (per-company read scoping, admin-only config).

## Develop

```bash
cd functions
npm install
npm run lint
npm test
npm run build
```

Integration tests (`*.integration.test.ts`) run against the Firebase emulator
and are kept out of `npm test` so the unit suite stays hermetic:

```bash
cd functions
npm run test:integration   # wraps vitest in `firebase emulators:exec --only firestore`
```

This covers the adapter pipeline (`ring → answer → hangup → cdr`, duplicate and
out-of-order delivery) and the security rules (cross-company read denied,
non-admin write to `dids` denied). A JVM is required for the emulator.

## Run the whole thing locally (emulator, no credentials)

Three shells from the repo root:

```bash
# 1. emulators (Firestore + Auth)
cd functions && npm install && npm run emulators

# 2. seed a company, the allow-list, a customer, calls and a live ring
cd functions && ALLOWED_EMAILS="you@gmail.com" npm run seed

# 3. the agent app (reads VITE_USE_EMULATORS from web/.env.local)
cd web && npm install && cp -n .env.example .env.local && npm run dev
#    → open http://127.0.0.1:5173, click "Continue with Google"; in the Auth
#      emulator's popup add an account using the allow-listed email above.
```

Sign-in is **Google with an allow-list**: only emails present in the Firestore
`allowlist/{email}` collection get a company/role; everyone else authenticates
but is denied all data by the security rules. The SPA connects straight to the
Auth + Firestore emulators (`web/src/firebase/client.ts`), so no real Firebase
project is needed. The seed writes a `ringing` doc, so the pop-up fires on
load; the calls log and customer timeline read live from Firestore. To see a ring arrive from an actual webhook instead of the seed,
run `npm run serve` in `functions/` (adds the functions emulator) and POST a
`ring` payload to the local `globalexWebhook` with a matching DID.

## CI/CD (GitHub Actions)

- **`.github/workflows/ci.yml`** — on every push and PR: functions
  (`lint → unit tests → build → emulator integration tests`) and web
  (`lint → typecheck → build`).
- **`.github/workflows/deploy.yml`** — on merge to `main` (or manual dispatch):
  build functions and web, deploy Firestore rules + indexes and Hosting (free
  plan), run pending data migrations, and optionally deploy Cloud Functions /
  seed demo data. See **CI/CD** below for the required secrets.

Deploy runs entirely in GitHub Actions — no credentials touch any dev machine.
The baseline deploy (Firestore rules + indexes and Hosting) works on the
**free Spark plan**; Cloud Functions are opt-in (they need the Blaze plan).

**Automated setup.** `scripts/provision-firebase.sh` does all of the below —
creates the project, enables Auth + Firestore, registers the web app, creates a
deploy service account, and sets the GitHub secrets — using your own gcloud /
firebase / gh logins. Run `bash scripts/provision-firebase.sh <project-id>`,
then merge to `main`. The manual steps are below if you prefer.

**One-time Firebase console setup**

1. Create a project (console.firebase.google.com).
2. Build → Authentication → enable **Email/Password**.
3. Build → Firestore Database → create (production mode).
4. Project settings → General → add a **Web app** → copy the `firebaseConfig`.
5. Project settings → Service accounts → **Generate new private key** (JSON).

**GitHub repository secrets** (Settings → Secrets and variables → Actions → Secrets):

| Secret | Purpose |
| --- | --- |
| `FIREBASE_PROJECT_ID` | Target project id |
| `FIREBASE_SERVICE_ACCOUNT` | The service-account JSON key (paste the whole file) |
| `VITE_FIREBASE_API_KEY` | From `firebaseConfig` (public web config) |
| `VITE_FIREBASE_AUTH_DOMAIN` | From `firebaseConfig` |
| `VITE_FIREBASE_APP_ID` | From `firebaseConfig` |

**GitHub repository variables** (same page → Variables), optional:

| Variable | Effect |
| --- | --- |
| `SEED_DEMO=true` | Seed a demo company + allow-list + sample data after deploy |
| `ALLOWED_EMAILS` | Comma-separated Google emails allowed to sign in (used by the seed) |
| `DEPLOY_FUNCTIONS=true` | Also deploy Cloud Functions (requires the Blaze plan) |

Sign-in uses **Google** with a Firestore allow-list; enable the Google provider
in Firebase console → Authentication → Sign-in method, and list the permitted
emails in `ALLOWED_EMAILS`.

Deploys run on every push to `main` (merge your branch via PR) or via
**Actions → Deploy → Run workflow**. The live app is then at
`https://<project-id>.web.app`.

### Migrations

Idempotent, ordered data migrations live in `functions/src/app/migrations/`.
Each has a stable id and is recorded in the `_migrations` Firestore ledger when
it succeeds, so re-runs are safe. Add one by appending a module to
`migrations/` and registering it in `registry.ts`; CD runs `npm run migrate`
after each deploy. Run locally against the emulator with:

```bash
cd functions && npm run build
firebase emulators:exec --only firestore --project demo-simple-crm "npm run migrate"
```

## Not yet (see docs/build-plan.md phases)

Recording copy to Cloud Storage, voicemail audio, email intake, the remaining
admin screens (DIDs, keyword rules), FCM push, and retention jobs. (In-app
**Users** admin — add/remove allow-listed Google accounts — is done.) Two open questions
remain with Globalex (voicemail audio location, recording-link auth/expiry) —
see `docs/globalex-webhook.md`.
