import type { Firestore, DocumentData } from 'firebase-admin/firestore';
import type { EventRepo } from '../../domain/ports/EventRepo.js';
import type { TimelineEvent } from '../../domain/events/types.js';

export class FirestoreEventRepo implements EventRepo {
  constructor(private readonly db: Firestore) {}

  async append(event: TimelineEvent): Promise<void> {
    await this.db.collection('events').doc(event.id).set(this.toDoc(event));
  }

  private toDoc(e: TimelineEvent): DocumentData {
    return {
      companyId: e.companyId,
      customerId: e.customerId,
      type: e.type,
      summary: e.summary,
      payload: { ...e.payload },
      at: e.at,
      source: e.source,
      ...(e.ticketId !== undefined ? { ticketId: e.ticketId } : {}),
    };
  }
}
