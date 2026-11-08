import type { Clock } from '../ports/Clock.js';
import type { IdGen } from '../ports/IdGen.js';
import type { CustomerRepo } from '../ports/CustomerRepo.js';
import type { Customer } from './types.js';

export interface FindOrCreateByPhoneInput {
  readonly companyId: string;
  readonly phoneE164: string;
  readonly name?: string;
}

export interface CustomerOutcome {
  readonly customer: Customer;
  /** True when a new customer was created rather than matched. */
  readonly created: boolean;
}

/**
 * Customer lookup/creation scoped to a company. A known (companyId, phone)
 * matches; an unknown one creates a phone-sourced customer. The same number in
 * two companies is two customers (docs/build-plan.md "Key rules").
 */
export class CustomerService {
  constructor(
    private readonly customers: CustomerRepo,
    private readonly clock: Clock,
    private readonly ids: IdGen,
  ) {}

  async findOrCreateByPhone(input: FindOrCreateByPhoneInput): Promise<CustomerOutcome> {
    const now = this.clock.now();
    const existing = await this.customers.findByPhone(input.companyId, input.phoneE164);
    if (existing) {
      const touched: Customer = { ...existing, lastContactAt: now };
      await this.customers.save(touched);
      return { customer: touched, created: false };
    }

    const customer: Customer = {
      id: this.ids.next(),
      companyId: input.companyId,
      phones: [input.phoneE164],
      emails: [],
      source: 'phone',
      createdAt: now,
      lastContactAt: now,
      tags: [],
      ...(input.name !== undefined ? { name: input.name } : {}),
    };
    const created = await this.customers.create(customer);
    return { customer: created, created: true };
  }
}
