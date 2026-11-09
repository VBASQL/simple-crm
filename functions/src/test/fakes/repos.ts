import type { CompanyRepo } from '../../domain/ports/CompanyRepo.js';
import type { CustomerRepo } from '../../domain/ports/CustomerRepo.js';
import type { CallRepo } from '../../domain/ports/CallRepo.js';
import type { TicketRepo } from '../../domain/ports/TicketRepo.js';
import type { EventRepo } from '../../domain/ports/EventRepo.js';
import type { RingingRepo } from '../../domain/ports/RingingRepo.js';
import type { RawEventStore } from '../../domain/ports/RawEventStore.js';
import type { SecretStore } from '../../domain/ports/SecretStore.js';
import type { RevealResult } from '../../domain/secrets/types.js';
import type { GlobalexPayload } from '../../shared/schemas/globalexPayload.js';
import type { Company } from '../../domain/companies/types.js';
import type { Customer } from '../../domain/customers/types.js';
import type { Call, RingingDoc } from '../../domain/calls/types.js';
import type { Ticket } from '../../domain/tickets/types.js';
import type { TimelineEvent } from '../../domain/events/types.js';

export class InMemoryCompanyRepo implements CompanyRepo {
  private readonly companies = new Map<string, Company>();
  private readonly didToCompany = new Map<string, string>();

  seedCompany(company: Company): this {
    this.companies.set(company.id, company);
    return this;
  }
  seedDid(didE164: string, companyId: string): this {
    this.didToCompany.set(didE164, companyId);
    return this;
  }
  async resolveByDid(didNumberE164: string): Promise<Company | null> {
    const companyId = this.didToCompany.get(didNumberE164);
    return companyId ? this.companies.get(companyId) ?? null : null;
  }
  async getById(companyId: string): Promise<Company | null> {
    return this.companies.get(companyId) ?? null;
  }
}

export class InMemoryCustomerRepo implements CustomerRepo {
  readonly byId = new Map<string, Customer>();
  createCount = 0;

  async getById(id: string): Promise<Customer | null> {
    return this.byId.get(id) ?? null;
  }
  async findByPhone(companyId: string, phoneE164: string): Promise<Customer | null> {
    for (const c of this.byId.values()) {
      if (c.companyId === companyId && c.phones.includes(phoneE164)) return c;
    }
    return null;
  }
  async findByEmail(companyId: string, email: string): Promise<Customer | null> {
    const lower = email.toLowerCase();
    for (const c of this.byId.values()) {
      if (c.companyId === companyId && c.emails.includes(lower)) return c;
    }
    return null;
  }
  async create(customer: Customer): Promise<Customer> {
    this.createCount += 1;
    this.byId.set(customer.id, customer);
    return customer;
  }
  async save(customer: Customer): Promise<void> {
    this.byId.set(customer.id, customer);
  }
}

export class InMemoryCallRepo implements CallRepo {
  readonly byId = new Map<string, Call>();
  upsertCount = 0;

  async get(callId: string): Promise<Call | null> {
    return this.byId.get(callId) ?? null;
  }
  async upsert(call: Call): Promise<void> {
    this.upsertCount += 1;
    this.byId.set(call.id, call);
  }
}

export class InMemoryTicketRepo implements TicketRepo {
  readonly byId = new Map<string, Ticket>();
  createCount = 0;

  async findOpen(companyId: string, customerId: string): Promise<Ticket | null> {
    for (const t of this.byId.values()) {
      if (t.companyId === companyId && t.customerId === customerId && t.status !== 'closed') return t;
    }
    return null;
  }
  async create(ticket: Ticket): Promise<Ticket> {
    this.createCount += 1;
    this.byId.set(ticket.id, ticket);
    return ticket;
  }
  async save(ticket: Ticket): Promise<void> {
    this.byId.set(ticket.id, ticket);
  }
}

export class InMemoryEventRepo implements EventRepo {
  readonly events: TimelineEvent[] = [];
  async append(event: TimelineEvent): Promise<void> {
    this.events.push(event);
  }
}

export class InMemoryRingingRepo implements RingingRepo {
  readonly byId = new Map<string, RingingDoc>();
  async set(doc: RingingDoc): Promise<void> {
    this.byId.set(doc.id, doc);
  }
  async delete(callId: string): Promise<void> {
    this.byId.delete(callId);
  }
}

export class InMemoryRawEventStore implements RawEventStore {
  readonly captured: { id: string; raw: unknown; event: GlobalexPayload; processed: boolean }[] = [];
  private seq = 0;

  async capture(rawBody: unknown, event: GlobalexPayload): Promise<string> {
    const id = `inbox-${(this.seq += 1)}`;
    this.captured.push({ id, raw: rawBody, event, processed: false });
    return id;
  }
  async markProcessed(id: string): Promise<void> {
    const row = this.captured.find((r) => r.id === id);
    if (row) row.processed = true;
  }
}

interface SecretDoc {
  secret: string;
  status: 'sealed' | 'opened';
  claimToken?: string;
  expiresAt?: Date;
}

export class InMemorySecretStore implements SecretStore {
  readonly docs = new Map<string, SecretDoc>();

  seal(id: string, secret: string, expiresAt?: Date): this {
    this.docs.set(id, { secret, status: 'sealed', ...(expiresAt ? { expiresAt } : {}) });
    return this;
  }

  async revealAndConsume(
    id: string,
    claimToken: string | undefined,
    now: Date,
    newToken: string,
  ): Promise<RevealResult> {
    const d = this.docs.get(id);
    if (d === undefined) return { kind: 'gone' };
    if (d.expiresAt !== undefined && d.expiresAt.getTime() <= now.getTime()) return { kind: 'gone' };
    if (d.status === 'sealed') {
      d.status = 'opened';
      d.claimToken = newToken;
      return { kind: 'revealed', secret: d.secret, claimToken: newToken };
    }
    if (d.status === 'opened' && claimToken !== undefined && claimToken.length > 0 && claimToken === d.claimToken) {
      return { kind: 'revealed', secret: d.secret, claimToken };
    }
    return { kind: 'gone' };
  }
}
