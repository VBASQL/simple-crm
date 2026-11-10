export type EventType =
  | 'call'
  | 'missed_call'
  | 'voicemail'
  | 'email'
  | 'order'
  | 'subscription'
  | 'meeting'
  | 'note';

/** The customer timeline. Every call, email and keyword hit writes one. */
export interface TimelineEvent {
  readonly id: string;
  readonly companyId: string;
  readonly customerId: string;
  readonly ticketId?: string;
  readonly type: EventType;
  readonly summary: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly at: Date;
  /** Where the event came from, e.g. 'globalex' or 'email'. */
  readonly source: string;
}
