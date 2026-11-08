# CLAUDE.md — Call-Driven CRM (Globalex webhook)

Read by Claude Code on every task in this repo. These rules are binding;
when in doubt, ask before deviating.

**External contract.** The Globalex webhook (transport, trigger events,
every field and which event carries it, our payload template, what each
event must do) lives in `docs/globalex-webhook.md`. Read it before touching
`functions/src/domain/calls`, the webhook handler, or any Zod schema for
inbound payloads. Never invent a field or behaviour that file does not
state; if it does not answer a question, stop and ask.


Stack: TypeScript (strict), Firebase Cloud Functions 2nd gen, Firestore,
Cloud Storage, Firebase Auth, React SPA on Firebase Hosting. Node 20.

## 1. Non-negotiables

1. **No business logic in a function handler.** A handler parses, validates, calls one service method, maps the result to a response. Nothing else.
2. **Every dependency is injected.** No module-level `admin.firestore()`, no `new Logger()` inside a class, no `Date.now()` or `crypto.randomUUID()` called directly in domain code. Clocks, ids, Firestore, Storage, HTTP, config and the logger are interfaces passed in via the constructor.
3. **Throw up, log once.** Domain and infra code never log errors; they throw. The composition root (the HTTP handler / scheduled job entry) is the single place that catches, logs once with the full chain, and maps to a response. See section 5.
4. **No blind spots.** Every branch is handled or explicitly rejected: exhaustive `switch` on unions with `never` checks, validated input at every boundary, no `any`, no non-null `!` without a comment saying why it cannot be null, no empty `catch`, no swallowed promise.
5. **One thing per file, one reason to change per class.** If a class needs more than ~5 injected dependencies, split it.
6. **Reusable means tested in isolation.** Every service has unit tests with fakes for its ports; no test touches real Firestore except the explicit `*.integration.test.ts` suite run against the emulator.
7. **Don't repeat what exists.** Before writing a helper, search `src/shared` and `src/domain`. Before adding a type, search for the field names. Duplication is a review blocker.
8. **Ask, don't assume.** If the Globalex contract in `docs/globalex-webhook.md` does not answer a question, stop and ask; do not invent fields or behaviours.

## 2. Layout

```
functions/src/
  app/            composition roots only (HTTP handlers, scheduled jobs, triggers)
    http/globalexWebhook.ts
    http/emailIntake.ts
    jobs/copyRecordings.ts
    jobs/autoCloseTickets.ts
    container.ts  builds the object graph once per cold start
  domain/         pure business logic; no Firebase imports, no I/O
    calls/        CallService, CallEvent types, CallStateMachine
    customers/    CustomerService, PhoneNormalizer
    tickets/      TicketService, TicketPolicy (resume / create / auto-close)
    email/        EmailIntakeService, RuleEngine
    ports/        interfaces: CallRepo, CustomerRepo, TicketRepo, EventRepo,
                  RingingRepo, CompanyRepo, FileStore, Clock, IdGen, Logger
  infra/          adapters implementing ports
    firestore/    FirestoreCallRepo, …
    storage/      GcsFileStore
    http/         FetchRecordingClient
    system/       SystemClock, UuidGen, PinoLogger
  shared/         Result/AppError types, Zod schemas, phone utils, time utils
  test/           fakes for every port (InMemoryCallRepo, FixedClock, …)
web/              React app; same rules: services injected via a context,
                  components render only
```

Import direction is one-way: `app → domain ← infra`. `domain` imports
nothing from `app` or `infra`. ESLint `import/no-restricted-paths` enforces
it; do not disable the rule.

## 3. Dependency injection pattern

Plain constructor injection; no DI framework.

```ts
// domain/ports/Clock.ts
export interface Clock { now(): Date }

// domain/tickets/TicketService.ts
export class TicketService {
  constructor(
    private readonly tickets: TicketRepo,
    private readonly events: EventRepo,
    private readonly clock: Clock,
    private readonly ids: IdGen,
    private readonly policy: TicketPolicy,
  ) {}

  async openOrResume(input: OpenOrResumeInput): Promise<Ticket> {
    const open = await this.tickets.findOpen(input.companyId, input.customerId);
    if (open && !this.policy.isStale(open, this.clock.now())) return open;
    return this.tickets.create({ ...input, id: this.ids.next(), openedAt: this.clock.now() });
  }
}

// app/container.ts — the only place real adapters are constructed
export function buildContainer(cfg: Config): Container {
  const logger = new PinoLogger(cfg.logLevel);
  const db = getFirestore();
  const clock = new SystemClock();
  const ids = new UuidGen();
  const ticketRepo = new FirestoreTicketRepo(db);
  const eventRepo = new FirestoreEventRepo(db);
  const ticketService = new TicketService(ticketRepo, eventRepo, clock, ids, new TicketPolicy(cfg.ticketAutoCloseDays));
  // …
  return { logger, ticketService, callService, customerService, … };
}
```

- Ports are interfaces in `domain/ports`; adapters in `infra` implement them; fakes in `test` implement them for unit tests.
- Config is a validated object (Zod) built once from `process.env` / Secret Manager in `container.ts`. Nothing else reads `process.env`.
- The container is built lazily once per instance and reused across invocations.

## 4. Errors: a single chain, thrown up

```ts
// shared/AppError.ts
export class AppError extends Error {
  constructor(
    message: string,
    readonly code: ErrorCode,          // 'VALIDATION' | 'NOT_FOUND' | 'UNAUTHORIZED' | 'CONFLICT' | 'UPSTREAM' | 'INTERNAL'
    readonly context: Record<string, unknown> = {},
    options?: { cause?: unknown },
  ) { super(message, options); this.name = 'AppError'; }
}
```

Rules:

- Every layer that catches an error **re-throws** an `AppError` with `{ cause }` set and *adds* context (`callId`, `companyId`, operation name). It never logs and never returns `null`/`undefined` to hide the failure.
- Catching is allowed only to (a) wrap and re-throw with context, (b) translate a known expected condition into a `Result` (e.g. `NOT_FOUND` from a lookup that is legitimately optional), or (c) at the composition root.
- Never catch `Error` to "keep going"; if the operation cannot complete, the event handler fails and the retry policy decides.
- No `console.*` anywhere. ESLint `no-console: error`.

## 5. Logging: proper, not redundant

One request = one log context = one error log at most.

- The composition root creates a child logger with the request's correlation fields: `{ reqId, callId, companyId, event }`. It passes that logger down **only** to code that emits informational logs (see below); domain services do not log errors.
- Levels:
  - `info` — one line per handled request at the end: outcome, duration ms, the decision taken (`customer: created|matched`, `ticket: created|resumed|none`). One line, structured, not a narrative.
  - `warn` — handled but notable conditions: unknown DID dropped, out-of-order event ignored, duplicate event ignored, lookup-before-send miss. One line each, with the ids needed to find the call.
  - `error` — **only at the composition root**, once, with the whole cause chain. Use `err` serializer so `cause` nests are printed.
  - `debug` — field-level detail (raw payload, matched rule) off in production.
- Do not log the same fact at two layers. If a service already returns a decision, the root logs it; the service does not also log "created customer".
- Never log secrets, API keys, full recording URLs with tokens, or email bodies. Mask with `shared/redact.ts`.
- Logger is a port (`Logger`) injected like everything else; tests use `NoopLogger` or `CapturingLogger` to assert on *one* error line.

## 6. Validation and no-blind-spot checklist

- All inbound payloads parsed with a Zod schema that lists every field in the payload template of `docs/globalex-webhook.md`; unknown keys are stripped, `""` is coerced to `undefined`.
- Phone numbers normalised to E.164 at the boundary via `PhoneNormalizer` (handles `05…`, `972…`, `+972…`, `0…`); never compare raw strings.
- All times parsed to `Date` at the boundary with the configured zone; stored as Firestore `Timestamp` in UTC.
- State transitions go through `CallStateMachine.transition(current, event)`; illegal transitions return a typed `Ignored` result (logged `warn` at root), never throw silently.
- Firestore writes are merges keyed by `call_id`; every write path is idempotent and covered by a "same event twice" test.
- Every `switch` on `event`, `disposition`, `direction`, rule `action` has a `default: assertNever(x)`.
- Every async call is awaited or explicitly `void`-ed with a comment; `@typescript-eslint/no-floating-promises: error`.
- Security rules tested with the emulator for: cross-company read denied, non-admin write to `dids` denied.

## 7. Testing requirements

- Unit: every domain service, with fakes from `test/`. Minimum cases per service: happy path, each error code it can raise, idempotent repeat.
- Contract: `GlobalexPayloadSchema` tested against one fixture per event from `test/fixtures/globalex/*.json` built from the example values in `docs/globalex-webhook.md`.
- Integration: webhook → emulator Firestore for ring/answer/hangup/cdr sequence, out-of-order delivery, duplicate delivery.
- No test may assert on log text except the single-error-line assertion in root tests.
- `npm test` must pass and `npm run lint` must be clean before any commit. Do not weaken a rule to pass; fix the code.

## 8. Working conventions

- Small PR-sized changes; one concern per commit; commit message states the behaviour change, not the files touched.
- Add a port before adding an adapter; add a fake before adding a test.
- When changing a Firestore shape, update `domain/*/types.ts`, the Zod schema, the fake repo and the fixture in the same change.
- Hebrew and English UI strings live in `web/src/i18n/{he,en}.json`; no literal UI text in components. RTL via `dir` attribute from the active locale.
- Config knobs (ticket auto-close days, retention months, language) are per-company Firestore fields with defaults in `shared/defaults.ts`; never hard-code them.

## 9. Definition of done for any task

- [ ] Handler is thin; logic is in a domain service with injected ports
- [ ] No new `console`, `any`, `!`, empty `catch`, or floating promise
- [ ] Errors thrown as `AppError` with cause + context; logged once at root
- [ ] One `info` line per request, `warn` for drops, no duplicate logs
- [ ] Unit tests with fakes; integration test if Firestore shape changed
- [ ] Lint and tests green; no rule disabled
- [ ] Anything not covered by `docs/globalex-webhook.md` was asked, not assumed
