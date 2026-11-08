import type { Clock } from '../ports/Clock.js';
import type { IdGen } from '../ports/IdGen.js';
import type { TicketRepo } from '../ports/TicketRepo.js';
import type { Ticket, TicketOpenedBy } from './types.js';
import type { TicketPolicy } from './TicketPolicy.js';

export interface OpenOrResumeInput {
  readonly companyId: string;
  readonly customerId: string;
  readonly openedBy: TicketOpenedBy;
  readonly subject?: string;
}

export interface TicketOutcome {
  readonly ticket: Ticket;
  /** True when an existing open ticket was reused rather than created. */
  readonly resumed: boolean;
}

/**
 * Enforces "at most one open ticket per customer". Resume = find a ticket with
 * status ≠ closed; if it is stale it is closed first and a fresh one opened so
 * the invariant always holds. See docs/build-plan.md "Key rules".
 */
export class TicketService {
  constructor(
    private readonly tickets: TicketRepo,
    private readonly clock: Clock,
    private readonly ids: IdGen,
    private readonly policy: TicketPolicy,
  ) {}

  async openOrResume(input: OpenOrResumeInput): Promise<TicketOutcome> {
    const now = this.clock.now();
    const open = await this.tickets.findOpen(input.companyId, input.customerId);

    if (open) {
      if (!this.policy.isStale(open, now)) {
        const resumed: Ticket = { ...open, lastActivityAt: now };
        await this.tickets.save(resumed);
        return { ticket: resumed, resumed: true };
      }
      // Stale: close it before opening a fresh one.
      await this.tickets.save({ ...open, status: 'closed', closedAt: now, lastActivityAt: now });
    }

    const ticket: Ticket = {
      id: this.ids.next(),
      companyId: input.companyId,
      customerId: input.customerId,
      status: 'open',
      openedBy: input.openedBy,
      openedAt: now,
      lastActivityAt: now,
      ...(input.subject !== undefined ? { subject: input.subject } : {}),
    };
    const created = await this.tickets.create(ticket);
    return { ticket: created, resumed: false };
  }
}
