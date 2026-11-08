import type { Ticket } from '../tickets/types.js';

export interface TicketRepo {
  /** The customer's open (status ≠ closed) ticket, or null. */
  findOpen(companyId: string, customerId: string): Promise<Ticket | null>;
  create(ticket: Ticket): Promise<Ticket>;
  save(ticket: Ticket): Promise<void>;
}
