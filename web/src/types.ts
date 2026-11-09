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
  | 'note';

export type Role = 'agent' | 'admin';

export interface UserProfile {
  /** The allow-listed email (the allowlist doc id). */
  readonly email: string;
  readonly companyId: string;
  readonly name?: string;
  readonly role: Role;
}

/** One allow-list entry — an email permitted to sign in, with its role. */
export interface AllowlistEntry {
  readonly email: string;
  readonly companyId: string;
  readonly role: Role;
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
}

export interface Ticket {
  readonly id: string;
  readonly companyId: string;
  readonly customerId: string;
  readonly status: TicketStatus;
  readonly subject?: string;
  readonly lastActivityAt?: Date;
}

export interface TimelineEvent {
  readonly id: string;
  readonly companyId: string;
  readonly customerId: string;
  readonly ticketId?: string;
  readonly type: EventType;
  readonly summary: string;
  readonly at?: Date;
}
