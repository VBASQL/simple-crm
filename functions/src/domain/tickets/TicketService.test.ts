import { describe, it, expect } from 'vitest';
import { TicketService } from './TicketService.js';
import { TicketPolicy } from './TicketPolicy.js';
import { InMemoryTicketRepo } from '../../test/fakes/index.js';

class FixedClock {
  constructor(private readonly d: Date) {}
  now(): Date {
    return this.d;
  }
}
class SeqIds {
  private n = 0;
  next(): string {
    this.n += 1;
    return `tk-new-${this.n}`;
  }
}

function makeSut(now: Date) {
  const tickets = new InMemoryTicketRepo();
  const svc = new TicketService(tickets, new FixedClock(now), new SeqIds(), new TicketPolicy(14));
  return { svc, tickets };
}

describe('TicketService.openOrResume', () => {
  it('routes a call to the most recently active open ticket when several are open', async () => {
    const now = new Date('2026-11-10T12:00:00Z');
    const { svc, tickets } = makeSut(now);
    const base = { companyId: 'co-1', customerId: 'c1', status: 'open' as const, openedBy: 'manual' as const };
    // Two open tickets; tk-b is the more recently active.
    tickets.byId.set('tk-a', { id: 'tk-a', ...base, openedAt: now, lastActivityAt: new Date('2026-11-10T10:00:00Z') });
    tickets.byId.set('tk-b', { id: 'tk-b', ...base, openedAt: now, lastActivityAt: new Date('2026-11-10T11:30:00Z') });

    const out = await svc.openOrResume({ companyId: 'co-1', customerId: 'c1', openedBy: 'call' });

    expect(out.resumed).toBe(true);
    expect(out.ticket.id).toBe('tk-b'); // the most recently active one
    expect(tickets.createCount).toBe(0);
  });

  it('opens a fresh ticket when the customer has none open', async () => {
    const now = new Date('2026-11-10T12:00:00Z');
    const { svc, tickets } = makeSut(now);
    const out = await svc.openOrResume({ companyId: 'co-1', customerId: 'c1', openedBy: 'call' });
    expect(out.resumed).toBe(false);
    expect(tickets.createCount).toBe(1);
  });
});
