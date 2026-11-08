export type TicketStatus = 'open' | 'pending' | 'closed';
export type TicketOpenedBy = 'call' | 'email' | 'manual';

/** At most one open ticket per customer at a time. */
export interface Ticket {
  readonly id: string;
  readonly companyId: string;
  readonly customerId: string;
  readonly status: TicketStatus;
  readonly subject?: string;
  readonly openedAt: Date;
  readonly closedAt?: Date;
  readonly openedBy: TicketOpenedBy;
  readonly lastActivityAt: Date;
  readonly assignedTo?: string;
}
