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
  // Seed profiles and data with rules bypassed.
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users', 'u-agent'), { companyId: 'co-1', role: 'agent' });
    await setDoc(doc(db, 'users', 'u-admin'), { companyId: 'co-1', role: 'admin' });
    await setDoc(doc(db, 'customers', 'c1'), { companyId: 'co-1', name: 'Own company' });
    await setDoc(doc(db, 'customers', 'c2'), { companyId: 'co-2', name: 'Other company' });
  });
});

describe('Firestore security rules', () => {
  it('lets an agent read a customer in their own company', async () => {
    const db = testEnv.authenticatedContext('u-agent').firestore();
    await assertSucceeds(getDoc(doc(db, 'customers', 'c1')));
  });

  it('denies cross-company reads', async () => {
    const db = testEnv.authenticatedContext('u-agent').firestore();
    await assertFails(getDoc(doc(db, 'customers', 'c2')));
  });

  it('denies a non-admin writing to dids', async () => {
    const db = testEnv.authenticatedContext('u-agent').firestore();
    await assertFails(setDoc(doc(db, 'dids', 'd1'), { companyId: 'co-1', number: '+97237654321' }));
  });

  it('allows an admin to write a did in their company', async () => {
    const db = testEnv.authenticatedContext('u-admin').firestore();
    await assertSucceeds(setDoc(doc(db, 'dids', 'd1'), { companyId: 'co-1', number: '+97237654321' }));
  });
});
