export type CallStatus = 'ringing' | 'answered' | 'missed' | 'voicemail';
export type CallDirection = 'inbound' | 'outbound' | 'internal';

/** One document per call, keyed by the Globalex call_id; events merge in place. */
export interface Call {
  readonly id: string;
  readonly companyId: string;
  readonly customerId: string;
  readonly direction: CallDirection;
  readonly status: CallStatus;
  readonly didNumber?: string;
  readonly callerNumber?: string;
  readonly startTime?: Date;
  readonly answerTime?: Date;
  readonly endTime?: Date;
  readonly duration?: number;
  readonly talkTime?: number;
  readonly answeringExtension?: string;
  readonly queueName?: string;
  readonly ivrInputs?: Readonly<Record<string, string>>;
  readonly recordingUrl?: string;
  readonly recordingStoragePath?: string;
  readonly voicemailStoragePath?: string;
  readonly ticketId?: string;
  /** Timestamp of the most recent event applied; used to reject stale events. */
  readonly lastEventAt: Date;
}

/** Short-lived pop-up signal; one per ringing call. */
export interface RingingDoc {
  readonly id: string;
  readonly companyId: string;
  readonly customerId: string;
  readonly callerNumber?: string;
  readonly didNumber?: string;
  readonly extension?: string;
  readonly startedAt: Date;
  readonly expiresAt: Date;
}
