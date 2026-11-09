import { Timestamp, type Firestore } from 'firebase-admin/firestore';
import type { RevealResult } from '../../domain/secrets/types.js';

/**
 * `secrets` collection, Admin-SDK only (clients are default-denied read/update).
 * The reveal/consume runs in a transaction so a sealed secret opens exactly once.
 * Structurally satisfies SecretStore; conformance is checked at the call site.
 */
export class FirestoreSecretStore {
  constructor(private readonly db: Firestore) {}

  async revealAndConsume(
    id: string,
    claimToken: string | undefined,
    now: Date,
    newToken: string,
  ): Promise<RevealResult> {
    const ref = this.db.collection('secrets').doc(id);
    return this.db.runTransaction<RevealResult>(async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.data();
      if (data === undefined) return { kind: 'gone' };

      const secret = typeof data.secret === 'string' ? data.secret : null;
      const expiresAt = data.expiresAt instanceof Timestamp ? data.expiresAt.toDate() : null;
      if (secret === null || (expiresAt !== null && expiresAt.getTime() <= now.getTime())) {
        return { kind: 'gone' };
      }

      if (data.status === 'sealed') {
        tx.update(ref, { status: 'opened', claimToken: newToken, openedAt: now });
        return { kind: 'revealed', secret, claimToken: newToken };
      }
      if (
        data.status === 'opened' &&
        typeof claimToken === 'string' &&
        claimToken.length > 0 &&
        claimToken === data.claimToken
      ) {
        return { kind: 'revealed', secret, claimToken };
      }
      return { kind: 'gone' };
    });
  }
}
