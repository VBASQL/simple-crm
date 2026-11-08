import { describe, it, expect } from 'vitest';
import { TicketPolicy } from './TicketPolicy.js';
import type { Ticket } from './types.js';

function ticket(lastActivityAt: Date): Ticket {
  return {
    id: 't-1',
    companyId: 'co-1',
    customerId: 'cu-1',
    status: 'open',
    openedBy: 'call',
    openedAt: lastActivityAt,
    lastActivityAt,
  };
}

describe('TicketPolicy', () => {
  const policy = new TicketPolicy(14);
  const now = new Date('2026-10-30T00:00:00Z');

  it('is not stale within the window', () => {
    const t = ticket(new Date('2026-10-20T00:00:00Z')); // 10 days
    expect(policy.isStale(t, now)).toBe(false);
  });

  it('is stale at/after the window', () => {
    const t = ticket(new Date('2026-10-16T00:00:00Z')); // 14 days
    expect(policy.isStale(t, now)).toBe(true);
  });
});
