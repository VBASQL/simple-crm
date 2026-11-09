import { FieldValue, type Firestore, type DocumentData } from 'firebase-admin/firestore';
import type { GlobalexPayload } from '../../shared/schemas/globalexPayload.js';
import type { RawEventMeta } from '../../domain/ports/RawEventStore.js';

/**
 * The `inbox` collection: one document per received webhook event, written
 * before the ack. Structurally satisfies RawEventStore. Client access is
 * denied by the default-deny Firestore rule; only the Admin SDK writes here.
 */
export class FirestoreRawEventStore {
  constructor(private readonly db: Firestore) {}

  async capture(rawBody: unknown, event: GlobalexPayload, meta: RawEventMeta): Promise<string> {
    const ref = this.db.collection('inbox').doc();
    const raw: DocumentData =
      typeof rawBody === 'object' && rawBody !== null ? rawBody : { value: String(rawBody) };
    await ref.set({
      event: event.event,
      callId: event.call_id,
      receivedAt: meta.receivedAt,
      reqId: meta.reqId,
      processed: false,
      raw,
    });
    return ref.id;
  }

  async markProcessed(id: string, outcome: Record<string, unknown>): Promise<void> {
    await this.db
      .collection('inbox')
      .doc(id)
      .set({ processed: true, processedAt: FieldValue.serverTimestamp(), outcome }, { merge: true });
  }
}
