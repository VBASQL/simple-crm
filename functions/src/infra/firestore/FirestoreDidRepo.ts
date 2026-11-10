import type { Firestore, DocumentData } from 'firebase-admin/firestore';
import type { Did } from '../../domain/companies/types.js';
import { optString } from './mappers.js';

/**
 * `dids` collection. Doc id is the E.164 number without the leading '+' (a
 * stable, unique key) so upsert/delete-by-number are direct. The `number` field
 * keeps the full E.164 that CompanyRepo.resolveByDid queries on.
 */
export class FirestoreDidRepo {
  constructor(private readonly db: Firestore) {}

  private docId(numberE164: string): string {
    return numberE164.replace(/^\+/, '');
  }

  async listByCompany(companyId: string): Promise<Did[]> {
    const snap = await this.db.collection('dids').where('companyId', '==', companyId).get();
    return snap.docs.map((d) => this.map(d.data()));
  }

  async getByNumber(numberE164: string): Promise<Did | null> {
    const doc = await this.db.collection('dids').doc(this.docId(numberE164)).get();
    const data = doc.data();
    return data === undefined ? null : this.map(data);
  }

  async upsert(did: Did): Promise<void> {
    await this.db
      .collection('dids')
      .doc(this.docId(did.number))
      .set({ number: did.number, companyId: did.companyId, ...(did.label !== undefined ? { label: did.label } : {}) });
  }

  async delete(numberE164: string): Promise<void> {
    await this.db.collection('dids').doc(this.docId(numberE164)).delete();
  }

  private map(data: DocumentData): Did {
    return {
      number: optString(data.number) ?? '',
      companyId: optString(data.companyId) ?? '',
      ...(optString(data.label) !== undefined ? { label: optString(data.label) as string } : {}),
    };
  }
}
