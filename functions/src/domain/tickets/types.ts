export type TicketStatus = 'open' | 'pending' | 'closed';
export type TicketOpenedBy = 'call' | 'email' | 'manual';

/**
 * A customer may have several open tickets. A call routes to the most recently
 * active open/pending one (TicketRepo.findOpen), and an agent can move it or
 * open a new ticket. (Earlier the model enforced one open ticket per customer.)
 */
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
