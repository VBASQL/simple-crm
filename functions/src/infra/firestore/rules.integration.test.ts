import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, deleteDoc, updateDoc, addDoc, collection } from 'firebase/firestore';

const PROJECT_ID = 'demo-crm-rules';

function rulesSource(): string {
  const url = new URL('../../../../firestore.rules', import.meta.url);
  return readFileSync(fileURLToPath(url), 'utf8');
}

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: rulesSource() },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  // Seed the allow-list and data with rules bypassed (flat: no roles).
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'allowlist', 'user@co1.com'), { companyId: 'co-1' });
    await setDoc(doc(db, 'customers', 'c1'), { companyId: 'co-1', name: 'Own company' });
    await setDoc(doc(db, 'customers', 'c2'), { companyId: 'co-2', name: 'Other company' });
    // A ticket and an existing event, to test agent updates and note immutability.
    await setDoc(doc(db, 'tickets', 'tk1'), { companyId: 'co-1', customerId: 'c1', status: 'open' });
    await setDoc(doc(db, 'events', 'e1'), { companyId: 'co-1', customerId: 'c1', type: 'call', summary: 'inbound' });
  });
});

const member = () => testEnv.authenticatedContext('u-1', { email: 'user@co1.com' }).firestore();
const stranger = () => testEnv.authenticatedContext('u-x', { email: 'nobody@elsewhere.com' }).firestore();

describe('Firestore security rules (flat allow-list)', () => {
  it('lets an allow-listed user read a customer in their own company', async () => {
    await assertSucceeds(getDoc(doc(member(), 'customers', 'c1')));
  });

  it('denies cross-company reads', async () => {
    await assertFails(getDoc(doc(member(), 'customers', 'c2')));
  });

  it('denies an email that is not on the allow-list', async () => {
    await assertFails(getDoc(doc(stranger(), 'customers', 'c1')));
  });

  it('lets any allow-listed user add another user to their company', async () => {
    await assertSucceeds(setDoc(doc(member(), 'allowlist', 'new@co1.com'), { companyId: 'co-1' }));
  });

  it('stops granting access to another company', async () => {
    await assertFails(setDoc(doc(member(), 'allowlist', 'x@co2.com'), { companyId: 'co-2' }));
  });

  it('stops a non-listed email from writing the allow-list', async () => {
    await assertFails(setDoc(doc(stranger(), 'allowlist', 'new@co1.com'), { companyId: 'co-1' }));
  });

  it('lets an allow-listed user remove an entry (including themselves)', async () => {
    await assertSucceeds(deleteDoc(doc(member(), 'allowlist', 'user@co1.com')));
  });

  it('denies a direct client write to dids (function-only, so numbers are normalised)', async () => {
    // DIDs are written exclusively by the manageDid function (Admin SDK); a raw
    // client write would skip E.164 normalisation and break call routing.
    await assertFails(setDoc(doc(member(), 'dids', 'd1'), { companyId: 'co-1', number: '+97237654321' }));
  });

  // Agent CRM actions on tickets and the timeline (client writes, rule-guarded).
  it('lets an allow-listed user change a ticket in their company', async () => {
    await assertSucceeds(updateDoc(doc(member(), 'tickets', 'tk1'), { status: 'closed' }));
  });

  it('lets an allow-listed user append a note to the timeline', async () => {
    await assertSucceeds(
      addDoc(collection(member(), 'events'), {
        companyId: 'co-1',
        customerId: 'c1',
        type: 'note',
        summary: 'Called back',
      }),
    );
  });

  it('stops an agent from forging a non-note event (e.g. a fake call)', async () => {
    await assertFails(
      addDoc(collection(member(), 'events'), {
        companyId: 'co-1',
        customerId: 'c1',
        type: 'call',
        summary: 'fake',
      }),
    );
  });

  it('stops adding a note to another company', async () => {
    await assertFails(
      addDoc(collection(member(), 'events'), {
        companyId: 'co-2',
        customerId: 'c2',
        type: 'note',
        summary: 'intrusion',
      }),
    );
  });

  it('keeps timeline events immutable (no edit, no delete)', async () => {
    await assertFails(updateDoc(doc(member(), 'events', 'e1'), { summary: 'tampered' }));
    await assertFails(deleteDoc(doc(member(), 'events', 'e1')));
  });
});
