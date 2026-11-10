import { FieldValue, type Firestore, type DocumentData } from 'firebase-admin/firestore';
import { optString } from './mappers.js';

/**
 * Resolves a signed-in email to its companies via the `allowlist` ledger. Used
 * by the composition root to derive the caller's tenant from their auth token
 * instead of trusting a client-supplied companyId. A member may belong to
 * several companies: entries carry a `companyIds` array (and we still read the
 * legacy single `companyId` so older entries keep working).
 */
export class FirestoreMembershipRepo {
  constructor(private readonly db: Firestore) {}

  private static companies(data: DocumentData): string[] {
    if (Array.isArray(data.companyIds)) {
      return data.companyIds.filter((x): x is string => typeof x === 'string');
    }
    const legacy = optString(data.companyId);
    return legacy !== undefined ? [legacy] : [];
  }

  async companyForEmail(email: string): Promise<string | null> {
    const companies = await this.companiesForEmail(email);
    return companies[0] ?? null;
  }

  async companiesForEmail(email: string): Promise<string[]> {
    const doc = await this.db.collection('allowlist').doc(email.toLowerCase()).get();
    const data = doc.data();
    return data === undefined ? [] : FirestoreMembershipRepo.companies(data);
  }

  async addCompany(email: string, companyId: string): Promise<void> {
    const ref = this.db.collection('allowlist').doc(email.toLowerCase());
    // Read-modify-write so a legacy single companyId is folded into the list
    // rather than dropped, and the companyId field is retired in the same step.
    const snap = await ref.get();
    const existing = snap.exists ? FirestoreMembershipRepo.companies(snap.data() ?? {}) : [];
    const companyIds = Array.from(new Set([...existing, companyId]));
    await ref.set({ companyIds, companyId: FieldValue.delete() }, { merge: true });
  }
}
