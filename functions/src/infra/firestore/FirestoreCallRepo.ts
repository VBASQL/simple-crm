import type { Firestore, DocumentData } from 'firebase-admin/firestore';
import type { CallRepo } from '../../domain/ports/CallRepo.js';
import type { Call, CallDirection, CallStatus } from '../../domain/calls/types.js';
import { optString, toDate, requireDate } from './mappers.js';

const STATUSES: readonly CallStatus[] = ['ringing', 'answered', 'missed', 'voicemail'];
const DIRECTIONS: readonly CallDirection[] = ['inbound', 'outbound', 'internal'];

export class FirestoreCallRepo implements CallRepo {
  constructor(private readonly db: Firestore) {}

  async get(callId: string): Promise<Call | null> {
    const doc = await this.db.collection('calls').doc(callId).get();
    if (!doc.exists) return null;
    return this.map(callId, doc.data() ?? {});
  }

  async upsert(call: Call): Promise<void> {
    await this.db.collection('calls').doc(call.id).set(this.toDoc(call), { merge: true });
  }

  private toDoc(c: Call): DocumentData {
    return {
      companyId: c.companyId,
      customerId: c.customerId,
      direction: c.direction,
      status: c.status,
      lastEventAt: c.lastEventAt,
      ...(c.didNumber !== undefined ? { didNumber: c.didNumber } : {}),
      ...(c.callerNumber !== undefined ? { callerNumber: c.callerNumber } : {}),
      ...(c.startTime !== undefined ? { startTime: c.startTime } : {}),
      ...(c.answerTime !== undefined ? { answerTime: c.answerTime } : {}),
      ...(c.endTime !== undefined ? { endTime: c.endTime } : {}),
      ...(c.duration !== undefined ? { duration: c.duration } : {}),
      ...(c.talkTime !== undefined ? { talkTime: c.talkTime } : {}),
      ...(c.answeringExtension !== undefined ? { answeringExtension: c.answeringExtension } : {}),
      ...(c.queueName !== undefined ? { queueName: c.queueName } : {}),
      ...(c.ivrInputs !== undefined ? { ivrInputs: { ...c.ivrInputs } } : {}),
      ...(c.recordingUrl !== undefined ? { recordingUrl: c.recordingUrl } : {}),
      ...(c.recordingStoragePath !== undefined ? { recordingStoragePath: c.recordingStoragePath } : {}),
      ...(c.voicemailStoragePath !== undefined ? { voicemailStoragePath: c.voicemailStoragePath } : {}),
      ...(c.ticketId !== undefined ? { ticketId: c.ticketId } : {}),
    };
  }

  private map(id: string, data: DocumentData): Call {
    const status = STATUSES.includes(data.status as CallStatus) ? (data.status as CallStatus) : 'ringing';
    const direction = DIRECTIONS.includes(data.direction as CallDirection)
      ? (data.direction as CallDirection)
      : 'inbound';
    const ivr = this.readIvr(data.ivrInputs);
    return {
      id,
      companyId: optString(data.companyId) ?? '',
      customerId: optString(data.customerId) ?? '',
      direction,
      status,
      lastEventAt: requireDate(data.lastEventAt, 'lastEventAt'),
      ...(optString(data.didNumber) !== undefined ? { didNumber: optString(data.didNumber) as string } : {}),
      ...(optString(data.callerNumber) !== undefined ? { callerNumber: optString(data.callerNumber) as string } : {}),
      ...(toDate(data.startTime) !== undefined ? { startTime: toDate(data.startTime) as Date } : {}),
      ...(toDate(data.answerTime) !== undefined ? { answerTime: toDate(data.answerTime) as Date } : {}),
      ...(toDate(data.endTime) !== undefined ? { endTime: toDate(data.endTime) as Date } : {}),
      ...(typeof data.duration === 'number' ? { duration: data.duration } : {}),
      ...(typeof data.talkTime === 'number' ? { talkTime: data.talkTime } : {}),
      ...(optString(data.answeringExtension) !== undefined
        ? { answeringExtension: optString(data.answeringExtension) as string }
        : {}),
      ...(optString(data.queueName) !== undefined ? { queueName: optString(data.queueName) as string } : {}),
      ...(ivr !== undefined ? { ivrInputs: ivr } : {}),
      ...(optString(data.recordingUrl) !== undefined ? { recordingUrl: optString(data.recordingUrl) as string } : {}),
      ...(optString(data.recordingStoragePath) !== undefined
        ? { recordingStoragePath: optString(data.recordingStoragePath) as string }
        : {}),
      ...(optString(data.voicemailStoragePath) !== undefined
        ? { voicemailStoragePath: optString(data.voicemailStoragePath) as string }
        : {}),
      ...(optString(data.ticketId) !== undefined ? { ticketId: optString(data.ticketId) as string } : {}),
    };
  }

  private readIvr(value: unknown): Record<string, string> | undefined {
    if (value === null || typeof value !== 'object') return undefined;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (typeof v === 'string') out[k] = v;
    }
    return Object.keys(out).length > 0 ? out : undefined;
  }
}
