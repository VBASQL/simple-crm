import type { Firestore, DocumentData } from 'firebase-admin/firestore';
import type { RingingRepo } from '../../domain/ports/RingingRepo.js';
import type { RingingDoc } from '../../domain/calls/types.js';

export class FirestoreRingingRepo implements RingingRepo {
  constructor(private readonly db: Firestore) {}

  async set(doc: RingingDoc): Promise<void> {
    await this.db.collection('ringing').doc(doc.id).set(this.toDoc(doc));
  }

  async delete(callId: string): Promise<void> {
    await this.db.collection('ringing').doc(callId).delete();
  }

  private toDoc(d: RingingDoc): DocumentData {
    return {
      companyId: d.companyId,
      customerId: d.customerId,
      startedAt: d.startedAt,
      expiresAt: d.expiresAt,
      ...(d.callerNumber !== undefined ? { callerNumber: d.callerNumber } : {}),
      ...(d.didNumber !== undefined ? { didNumber: d.didNumber } : {}),
      ...(d.extension !== undefined ? { extension: d.extension } : {}),
    };
  }
}
