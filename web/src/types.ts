// View models for the SPA. These mirror the Firestore documents written by the
// functions (see functions/src/domain/*/types.ts and docs/build-plan.md).
// Timestamps are converted to Date in the repositories at the read boundary.

export type CallStatus = 'ringing' | 'answered' | 'missed' | 'voicemail';
export type CallDirection = 'inbound' | 'outbound' | 'internal';
export type TicketStatus = 'open' | 'pending' | 'closed';
export type EventType =
  | 'call'
  | 'missed_call'
  | 'voicemail'
  | 'email'
  | 'order'
  | 'subscription'
  | 'meeting'
  | 'note';

export interface UserProfile {
  /** The allow-listed email (the allowlist doc id). */
  readonly email: string;
  readonly companyId: string;
  readonly name?: string;
}

/** One allow-list entry — an email permitted to sign in. */
export interface AllowlistEntry {
  readonly email: string;
  readonly companyId: string;
}

/** A dialled number mapped to the company (E.164). */
export interface Did {
  readonly number: string;
  readonly label?: string;
}

export interface RingingDoc {
  readonly id: string;
  readonly companyId: string;
  readonly customerId: string;
  readonly callerNumber?: string;
  readonly didNumber?: string;
  readonly extension?: string;
  readonly startedAt?: Date;
}

export interface Call {
  readonly id: string;
  readonly companyId: string;
  readonly customerId: string;
  readonly direction: CallDirection;
  readonly status: CallStatus;
  readonly callerNumber?: string;
  readonly didNumber?: string;
  readonly answeringExtension?: string;
  readonly startTime?: Date;
  readonly duration?: number;
  readonly recordingUrl?: string;
  readonly ticketId?: string;
}

export interface Customer {
  readonly id: string;
  readonly companyId: string;
  readonly name?: string;
  readonly phones: readonly string[];
  readonly emails: readonly string[];
  readonly source: 'phone' | 'email' | 'manual';
  readonly tags: readonly string[];
  readonly createdAt?: Date;
  readonly lastContactAt?: Date;
  /** Agent-set: pinned records sort to the top of lists. */
  readonly pinned?: boolean;
}

export interface Ticket {
  readonly id: string;
  readonly companyId: string;
  readonly customerId: string;
  readonly status: TicketStatus;
  readonly subject?: string;
  readonly openedAt?: Date;
  readonly lastActivityAt?: Date;
  /** Agent-set: pinned tickets sort to the top of lists. */
  readonly pinned?: boolean;
}

export interface TimelineEvent {
  readonly id: string;
  readonly companyId: string;
  readonly customerId: string;
  readonly ticketId?: string;
  readonly type: EventType;
  readonly summary: string;
  /** Structured detail the engine (or a note) attached, e.g. { callId }. */
  readonly payload?: Readonly<Record<string, unknown>>;
  readonly at?: Date;
}
