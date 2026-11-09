import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import { initializeApp, deleteApp, type App } from 'firebase-admin/app';
import { getFirestore, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { FirestoreSecretStore } from './FirestoreSecretStore.js';

const PROJECT_ID = 'demo-crm-secrets';
let app: App;
let db: Firestore;
let store: FirestoreSecretStore;

beforeAll(() => {
  app = initializeApp({ projectId: PROJECT_ID }, 'secrets-int');
  db = getFirestore(app);
  db.settings({ ignoreUndefinedProperties: true });
  store = new FirestoreSecretStore(db);
});

afterAll(async () => {
  await deleteApp(app);
});

async function clear(): Promise<void> {
  const host = process.env.FIRESTORE_EMULATOR_HOST;
  await fetch(`http://${host}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`, { method: 'DELETE' });
}

beforeEach(clear);

describe('FirestoreSecretStore against the emulator', () => {
  it('reveals a sealed secret once, re-reveals only with the claim token', async () => {
    const now = new Date('2026-11-09T12:00:00Z');
    await db.collection('secrets').doc('s1').set({
      secret: 'hunter2',
      status: 'sealed',
      expiresAt: Timestamp.fromDate(new Date('2026-11-16T12:00:00Z')),
    });

    const first = await store.revealAndConsume('s1', undefined, now, 'tok-1');
    expect(first).toEqual({ kind: 'revealed', secret: 'hunter2', claimToken: 'tok-1' });

    const doc = await db.collection('secrets').doc('s1').get();
    expect(doc.get('status')).toBe('opened');

    await expect(store.revealAndConsume('s1', 'tok-1', now, 'tok-2')).resolves.toMatchObject({ kind: 'revealed' });
    await expect(store.revealAndConsume('s1', 'wrong', now, 'tok-3')).resolves.toEqual({ kind: 'gone' });
    await expect(store.revealAndConsume('s1', undefined, now, 'tok-4')).resolves.toEqual({ kind: 'gone' });
  });

  it('returns gone for unknown and expired secrets', async () => {
    const now = new Date('2026-11-09T12:00:00Z');
    await expect(store.revealAndConsume('missing', undefined, now, 't')).resolves.toEqual({ kind: 'gone' });

    await db.collection('secrets').doc('old').set({
      secret: 'x',
      status: 'sealed',
      expiresAt: Timestamp.fromDate(new Date('2026-11-08T00:00:00Z')),
    });
    await expect(store.revealAndConsume('old', undefined, now, 't')).resolves.toEqual({ kind: 'gone' });
  });
});
