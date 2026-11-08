import type { Ticket } from './types.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Decides when an open ticket is stale enough to auto-close. The number of
 * days is a per-company config knob (CLAUDE.md §8), passed in at construction.
 */
export class TicketPolicy {
  constructor(private readonly autoCloseDays: number) {}

  isStale(ticket: Ticket, now: Date): boolean {
    const idleMs = now.getTime() - ticket.lastActivityAt.getTime();
    return idleMs >= this.autoCloseDays * MS_PER_DAY;
  }
}
