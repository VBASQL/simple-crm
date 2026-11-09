import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';

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

  it('lets an allow-listed user manage a did in their company', async () => {
    await assertSucceeds(setDoc(doc(member(), 'dids', 'd1'), { companyId: 'co-1', number: '+97237654321' }));
  });
});
