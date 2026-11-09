import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';

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
  // Seed the allow-list and data with rules bypassed.
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'allowlist', 'agent@co1.com'), { companyId: 'co-1', role: 'agent' });
    await setDoc(doc(db, 'allowlist', 'admin@co1.com'), { companyId: 'co-1', role: 'admin' });
    await setDoc(doc(db, 'customers', 'c1'), { companyId: 'co-1', name: 'Own company' });
    await setDoc(doc(db, 'customers', 'c2'), { companyId: 'co-2', name: 'Other company' });
  });
});

const agent = () => testEnv.authenticatedContext('u-agent', { email: 'agent@co1.com' }).firestore();
const admin = () => testEnv.authenticatedContext('u-admin', { email: 'admin@co1.com' }).firestore();
const stranger = () => testEnv.authenticatedContext('u-x', { email: 'nobody@elsewhere.com' }).firestore();

describe('Firestore security rules', () => {
  it('lets an allow-listed agent read a customer in their own company', async () => {
    await assertSucceeds(getDoc(doc(agent(), 'customers', 'c1')));
  });

  it('denies cross-company reads', async () => {
    await assertFails(getDoc(doc(agent(), 'customers', 'c2')));
  });

  it('denies an email that is not on the allow-list', async () => {
    await assertFails(getDoc(doc(stranger(), 'customers', 'c1')));
  });

  it('denies a non-admin writing to dids', async () => {
    await assertFails(setDoc(doc(agent(), 'dids', 'd1'), { companyId: 'co-1', number: '+97237654321' }));
  });

  it('allows an admin to write a did in their company', async () => {
    await assertSucceeds(setDoc(doc(admin(), 'dids', 'd1'), { companyId: 'co-1', number: '+97237654321' }));
  });
});
