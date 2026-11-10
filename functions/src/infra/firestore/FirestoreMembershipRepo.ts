import type { Firestore } from 'firebase-admin/firestore';
import { optString } from './mappers.js';

/**
 * Resolves a signed-in email to its company via the `allowlist` ledger. Used by
 * the composition root to derive the caller's tenant from their auth token
 * instead of trusting a client-supplied companyId.
 */
export class FirestoreMembershipRepo {
  constructor(private readonly db: Firestore) {}

  async companyForEmail(email: string): Promise<string | null> {
    const doc = await this.db.collection('allowlist').doc(email.toLowerCase()).get();
    const data = doc.data();
    return data === undefined ? null : optString(data.companyId) ?? null;
  }
}
