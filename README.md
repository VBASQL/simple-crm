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
and are opt-in; `npm test` runs the unit suite only.

## Not yet (see docs/build-plan.md phases)

Recording copy to Cloud Storage, voicemail audio, email intake, the SPA, FCM
push, retention jobs. Two open questions remain with Globalex (voicemail audio
location, recording-link auth/expiry) — see `docs/globalex-webhook.md`.
