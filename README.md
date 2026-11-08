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
web/                    React agent SPA (placeholder; Phase 1 UI pending).
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

## CI/CD (GitHub Actions)

- **`.github/workflows/ci.yml`** — on every push and PR: `lint → unit tests →
  build → emulator integration tests`.
- **`.github/workflows/deploy.yml`** — on merge to `main` (or manual dispatch):
  build, deploy Firestore rules + indexes and the Cloud Functions, then run
  pending data migrations against the live project.

Deploy needs two repository secrets:

| Secret | Purpose |
| --- | --- |
| `FIREBASE_PROJECT_ID` | Target Firebase/GCP project id |
| `FIREBASE_SERVICE_ACCOUNT` | JSON key for a service account with Cloud Functions Admin, Firebase Rules Admin, Firestore, and Service Account User roles |

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

Recording copy to Cloud Storage, voicemail audio, email intake, the SPA, FCM
push, retention jobs. Two open questions remain with Globalex (voicemail audio
location, recording-link auth/expiry) — see `docs/globalex-webhook.md`.
