# Call-Driven CRM — Build Plan (Globalex Webhook)

Nov 3, 2026 · @aberham

## Overview

A lightweight CRM that builds customer records and tickets from Globalex PBX webhooks and forwarded email, with a live pop-up when a call comes in. It never touches the calls themselves; Globalex handles telephony and this system only listens.

**What it does**

- Receives the Globalex webhook events (ringing, answered, hangup, CDR, DTMF) at an endpoint you give to the provider.
- Serves several companies: each DID (dialled number) belongs to one company, and every record is scoped to that company.
- A call from an unknown number creates a customer under the DID's company; a known number attaches to the existing customer.
- A new call opens a ticket; the next call from the same customer resumes the open ticket unless it was closed.
- Stores missed calls, voicemail and recordings when the webhook carries them (recording links come on the CDR event; voicemail is inferred from the routing fields).
- Pops up the customer profile and open tickets on the agent's screen the moment the phone rings.
- Accepts forwarded email: unknown sender creates a customer, keywords in the subject or body decide whether to open a ticket or log an event (order, campaign subscription, etc.).
- Links an email-only customer to a phone-only customer when one record is missing the field the other has.

**What it does not do**

- Place, answer, transfer or record calls.
- Replace the PBX call log; Globalex remains the source of truth for billing.

Stack: Firebase (Auth, Firestore, Cloud Functions, Hosting, Cloud Messaging) plus Google Cloud Storage for recording and voicemail copies.

## Architecture

All of it runs on Firebase and Google Cloud, with no servers to manage. Two Cloud Functions do the writing (one for webhooks, one for email); the agent app only reads.

Globalex posts call events to the webhook function; forwarded mail reaches the email function. Both write to Firestore, recordings are copied to Cloud Storage, and the agent app listens to Firestore in real time.

| Component | Service | Role |
| --- | --- | --- |
| Webhook endpoint | Cloud Functions (HTTPS, 2nd gen) | Receives Globalex events, validates the secret, matches customer and ticket, writes records |
| Email intake | Cloud Functions + Gmail API (or IMAP poll every 1–2 min) | Reads forwarded mail, applies keyword rules, creates customers, tickets or events |
| Database | Firestore | Companies, DIDs, customers, calls, tickets, events, users |
| Files | Cloud Storage | Copies of recordings and voicemail audio, one bucket per company prefix |
| Live pop-up | Firestore realtime listeners + Firebase Cloud Messaging | Agent screens subscribe to a per-company "ringing" collection; FCM wakes closed tabs |
| Agent app | Firebase Hosting, single-page app (React or Vue) | Customer pages, tickets, call log, pop-up dialog, admin screens |
| Auth | Firebase Authentication | Email/password or Google sign-in; each user belongs to one company |
| Scheduled jobs | Cloud Scheduler + Cloud Functions | Nightly: fetch recordings not yet copied, close stale tickets, clean the ringing collection |

## Data model

Everything hangs off a company, and the company is found from the DID the call came in on. Phone numbers are stored normalized (E.164, e.g. +972521234567) so the same person is matched whether Globalex sends 052…, 972… or +972….

| Collection | Key fields | Notes |
| --- | --- | --- |
| companies | id, name, timezone, language (he / en), email intake address, keyword rules[], ticketAutoCloseDays (default 14), settings | One per business you serve |
| dids | number (E.164), companyId, label | One DID → one company; the webhook's did_number decides the tenant |
| users | uid, companyId, name, extension, role (agent / admin), fcmTokens[] | Extension lets the pop-up go to the right agent when answeringExtension is known |
| customers | id, companyId, name, phones[] (E.164), emails[], source (phone / email / manual), createdAt, lastContactAt, tags[], mergedInto | A customer can start with only a phone or only an email |
| calls | id = Globalex call_id, companyId, customerId, direction, didNumber, callerNumber, status (ringing / answered / missed / voicemail), startTime, answerTime, endTime, duration, talkTime, answeringExtension, queueName, ivrInputs{}, recordingUrl, recordingStoragePath, voicemailStoragePath, ticketId, rawEvents[] | One document per call; events update it in place |
| tickets | id, companyId, customerId, status (open / pending / closed), subject, openedAt, closedAt, openedBy (call / email / manual), lastActivityAt, assignedTo | At most one open ticket per customer at a time |
| events | id, companyId, customerId, ticketId?, type (call / missed_call / voicemail / email / order / subscription / note), summary, payload{}, at, source | The customer timeline; every call, email and keyword hit writes one |
| ringing | id = call_id, companyId, customerId, callerNumber, didNumber, extension, startedAt, expiresAt | Short-lived; what the pop-up listens to. Deleted on answer/hangup or after 2 minutes |
| emailRules | companyId, keyword or regex, matchOn (subject / body / sender), action (open_ticket / log_event), eventType, priority | Evaluated in priority order; first match wins |

**Key rules**

- Customer lookup is by (companyId, phone) or (companyId, email). Same number across two companies = two separate customers.
- One open ticket per customer. "Resume" means: find ticket where customerId = X and status ≠ closed; if none, create.
- A merge (email customer + phone customer) keeps one customerId, copies the missing field, and sets mergedInto on the other so old links still resolve.
- Firestore security rules allow a user to read only documents whose companyId equals their own; writes from the app are limited to tickets, notes and customer edits. Functions write with admin credentials.

## Build phases and open questions

Four phases; the first one already gives you working customers, tickets and the pop-up.

| Phase | Scope | Done when |
| --- | --- | --- |
| 1 — Calls in | Firebase project, auth, companies + DIDs, webhook function, customer auto-create, ticket resume/create, calls log, customer page timeline, pop-up | A real inbound call from Globalex shows a pop-up and lands on a customer with an open ticket |
| 2 — Audio | Recording links on CDR, copy to Cloud Storage, voicemail detection, player on the customer page, missed-call and voicemail inbox | Answered, missed and voicemail calls each play back correctly |
| 3 — Email | Intake address, forwarding parser, keyword rules admin, email-created customers, log_event vs open_ticket, manual link and possible-match cards | A forwarded order email logs an order event; a complaint email opens a ticket; an email customer can be linked to a phone customer |
| 4 — Polish | FCM push for closed tabs, retention jobs, per-extension pop-up targeting, exports, reporting | Agents use it daily without the PBX portal |

**Open questions for Globalex**

- [ ] Voicemail audio: is the message file what `recording_download_url` points to on a voicemail call, or a separate file reachable another way?
- [ ] Recording links: do `recording_play_url` / `recording_download_url` need a login, and how long do they stay valid?

**Decisions**

- Email provider: Gmail (Gmail API with a forwarding rule into the intake label).
- Outbound calls: logged and marked answered / not answered, never a ticket by themselves; the agent is asked at call end whether to open a ticket and can add a note.
- Open tickets auto-close after 14 days with no activity; the number is set per company in Admin.
- Interface in Hebrew and English, switchable per user, with right-to-left layout for Hebrew.

> This is a condensed copy of the original build plan for in-repo reference.
> The binding external contract is `docs/globalex-webhook.md`.
