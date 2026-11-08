import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import { initializeApp, deleteApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

import { CallService } from '../../domain/calls/CallService.js';
import { CustomerService } from '../../domain/customers/CustomerService.js';
import { TicketService } from '../../domain/tickets/TicketService.js';
import { TicketPolicy } from '../../domain/tickets/TicketPolicy.js';
import { PhoneNormalizer } from '../../domain/customers/PhoneNormalizer.js';
import { GlobalexPayloadSchema } from '../../shared/schemas/globalexPayload.js';
import { SystemClock } from '../system/SystemClock.js';
import { UuidGen } from '../system/UuidGen.js';
import { FirestoreCompanyRepo } from './FirestoreCompanyRepo.js';
import { FirestoreCustomerRepo } from './FirestoreCustomerRepo.js';
import { FirestoreCallRepo } from './FirestoreCallRepo.js';
import { FirestoreTicketRepo } from './FirestoreTicketRepo.js';
import { FirestoreEventRepo } from './FirestoreEventRepo.js';
import { FirestoreRingingRepo } from './FirestoreRingingRepo.js';

const PROJECT_ID = 'demo-simple-crm';
const CALL_ID = 'int-1763328773.1';
const DID_E164 = '+97237654321';

let app: App;
let db: Firestore;

function payload(overrides: Record<string, unknown>) {
  return GlobalexPayloadSchema.parse({
    call_id: CALL_ID,
    direction: 'inbound',
    caller_number: '0521234567',
    did_number: '037654321',
    ...overrides,
  });
}

function makeService() {
  const clock = new SystemClock();
  const ids = new UuidGen();
  return new CallService(
    new FirestoreCompanyRepo(db),
    new CustomerService(new FirestoreCustomerRepo(db), clock, ids),
    new TicketService(new FirestoreTicketRepo(db), clock, ids, new TicketPolicy(14)),
    new FirestoreCallRepo(db),
    new FirestoreEventRepo(db),
    new FirestoreRingingRepo(db),
    clock,
    ids,
    new PhoneNormalizer(),
  );
}

async function clearFirestore(): Promise<void> {
  const host = process.env.FIRESTORE_EMULATOR_HOST;
  await fetch(`http://${host}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`, {
    method: 'DELETE',
  });
}

async function countCustomers(): Promise<number> {
  const snap = await db.collection('customers').where('companyId', '==', 'co-1').get();
  return snap.size;
}

beforeAll(() => {
  app = initializeApp({ projectId: PROJECT_ID }, 'integration');
  db = getFirestore(app);
  db.settings({ ignoreUndefinedProperties: true });
});

afterAll(async () => {
  await deleteApp(app);
});

beforeEach(async () => {
  await clearFirestore();
  await db.collection('companies').doc('co-1').set({
    name: 'Acme',
    timezone: 'Asia/Jerusalem',
    language: 'he',
    ticketAutoCloseDays: 14,
    retentionMonths: 12,
  });
  await db.collection('dids').doc('d1').set({ number: DID_E164, companyId: 'co-1' });
});

describe('Globalex call pipeline against the Firestore emulator', () => {
  it('runs ring → answer → hangup → cdr into coherent documents', async () => {
    const svc = makeService();
    await svc.handle(payload({ event: 'ring', timestamp: '2026-10-30T14:05:09+02:00', extension: '201' }));
    await svc.handle(payload({ event: 'answer', timestamp: '2026-10-30T14:05:13+02:00', answering_extension: '201' }));
    await svc.handle(payload({ event: 'hangup', timestamp: '2026-10-30T14:06:02+02:00' }));
    await svc.handle(
      payload({
        event: 'cdr',
        timestamp: '2026-10-30T14:06:03+02:00',
        disposition: 'ANSWERED',
        duration: '53',
        talk_time: '49',
      }),
    );

    const call = await db.collection('calls').doc(CALL_ID).get();
    expect(call.get('status')).toBe('answered');
    expect(call.get('duration')).toBe(53);
    expect(call.get('customerId')).toBeTypeOf('string');

    expect(await countCustomers()).toBe(1);
    const tickets = await db.collection('tickets').where('companyId', '==', 'co-1').get();
    expect(tickets.size).toBe(1);
    const ringing = await db.collection('ringing').doc(CALL_ID).get();
    expect(ringing.exists).toBe(false);
    const events = await db.collection('events').where('companyId', '==', 'co-1').get();
    expect(events.docs.some((d) => d.get('type') === 'call')).toBe(true);
  });

  it('is idempotent on duplicate delivery of the same ring', async () => {
    const svc = makeService();
    const ring = payload({ event: 'ring', timestamp: '2026-10-30T14:05:09+02:00' });
    await svc.handle(ring);
    await svc.handle(ring);

    expect(await countCustomers()).toBe(1);
    const tickets = await db.collection('tickets').where('companyId', '==', 'co-1').get();
    expect(tickets.size).toBe(1);
  });

  it('ignores an out-of-order answer older than the stored state', async () => {
    const svc = makeService();
    await svc.handle(payload({ event: 'ring', timestamp: '2026-10-30T14:05:09+02:00' }));
    const out = await svc.handle(payload({ event: 'answer', timestamp: '2026-10-30T14:05:00+02:00' }));

    expect(out).toMatchObject({ result: 'ignored', reason: 'out_of_order' });
    const call = await db.collection('calls').doc(CALL_ID).get();
    expect(call.get('status')).toBe('ringing');
    const ringing = await db.collection('ringing').doc(CALL_ID).get();
    expect(ringing.exists).toBe(true);
  });
});
