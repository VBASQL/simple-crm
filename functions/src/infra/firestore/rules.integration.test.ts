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
    // A member of two companies, in the new companyIds (array) form.
    await setDoc(doc(db, 'allowlist', 'multi@co.com'), { companyIds: ['co-1', 'co-2'] });
    await setDoc(doc(db, 'companies', 'co-1'), { name: 'Acme', ticketAutoCloseDays: 14 });
    await setDoc(doc(db, 'companies', 'co-2'), { name: 'Globex', ticketAutoCloseDays: 14 });
    await setDoc(doc(db, 'customers', 'c1'), { companyId: 'co-1', name: 'Own company' });
    await setDoc(doc(db, 'customers', 'c2'), { companyId: 'co-2', name: 'Other company' });
    // A ticket and an existing event, to test agent updates and note immutability.
    await setDoc(doc(db, 'tickets', 'tk1'), { companyId: 'co-1', customerId: 'c1', status: 'open' });
    await setDoc(doc(db, 'events', 'e1'), { companyId: 'co-1', customerId: 'c1', type: 'call', summary: 'inbound' });
  });
});

const member = () => testEnv.authenticatedContext('u-1', { email: 'user@co1.com' }).firestore();
const multi = () => testEnv.authenticatedContext('u-2', { email: 'multi@co.com' }).firestore();
const stranger = () => testEnv.authenticatedContext('u-x', { email: 'nobody@elsewhere.com' }).firestore();

describe('Firestore security rules (flat allow-list)', () => {
  it('lets an allow-listed user read a customer in their own company', async () => {
    await assertSucceeds(getDoc(doc(member(), 'customers', 'c1')));
  });

  it('denies cross-company reads', async () => {
    await assertFails(getDoc(doc(member(), 'customers', 'c2')));
  });

  it('lets a multi-company member read data in each of their companies', async () => {
    await assertSucceeds(getDoc(doc(multi(), 'customers', 'c1')));
    await assertSucceeds(getDoc(doc(multi(), 'customers', 'c2')));
  });

  it('lets a multi-company member add a user to a company they belong to', async () => {
    await assertSucceeds(setDoc(doc(multi(), 'allowlist', 'new@co.com'), { companyIds: ['co-2'] }));
  });

  it('stops adding a user to a company the editor does not belong to', async () => {
    await assertFails(setDoc(doc(member(), 'allowlist', 'x@co.com'), { companyIds: ['co-2'] }));
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

  it('lets an allow-listed user append a manual note or meeting to the timeline', async () => {
    await assertSucceeds(
      addDoc(collection(member(), 'events'), {
        companyId: 'co-1',
        customerId: 'c1',
        type: 'note',
        summary: 'Called back',
        source: 'manual',
      }),
    );
    await assertSucceeds(
      addDoc(collection(member(), 'events'), {
        companyId: 'co-1',
        customerId: 'c1',
        type: 'meeting',
        summary: 'Met at the office',
        source: 'manual',
      }),
    );
  });

  it('stops an agent from forging an engine-captured event (source not manual)', async () => {
    await assertFails(
      addDoc(collection(member(), 'events'), {
        companyId: 'co-1',
        customerId: 'c1',
        type: 'call',
        summary: 'fake auto call',
        source: 'globalex',
      }),
    );
  });

  it('stops a manual entry of a type outside the allowed set', async () => {
    await assertFails(
      addDoc(collection(member(), 'events'), {
        companyId: 'co-1',
        customerId: 'c1',
        type: 'voicemail',
        summary: 'fake voicemail',
        source: 'manual',
      }),
    );
  });

  it('stops adding an entry to another company', async () => {
    await assertFails(
      addDoc(collection(member(), 'events'), {
        companyId: 'co-2',
        customerId: 'c2',
        type: 'note',
        summary: 'intrusion',
        source: 'manual',
      }),
    );
  });

  it('keeps timeline events immutable (no edit, no delete)', async () => {
    await assertFails(updateDoc(doc(member(), 'events', 'e1'), { summary: 'tampered' }));
    await assertFails(deleteDoc(doc(member(), 'events', 'e1')));
  });

  it('lets a member edit their own company settings', async () => {
    await assertSucceeds(updateDoc(doc(member(), 'companies', 'co-1'), { ticketAutoCloseDays: 30 }));
  });

  it('stops editing another company settings, and creating/deleting companies', async () => {
    await assertFails(updateDoc(doc(member(), 'companies', 'co-2'), { ticketAutoCloseDays: 1 }));
    await assertFails(setDoc(doc(member(), 'companies', 'co-new'), { name: 'X' }));
    await assertFails(deleteDoc(doc(member(), 'companies', 'co-1')));
  });
});
