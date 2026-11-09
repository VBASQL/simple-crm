import type { Customer } from '../customers/types.js';

export interface CustomerRepo {
  getById(id: string): Promise<Customer | null>;
  findByPhone(companyId: string, phoneE164: string): Promise<Customer | null>;
  findByEmail(companyId: string, email: string): Promise<Customer | null>;
  create(customer: Customer): Promise<Customer>;
  /** Full-document merge by id (idempotent). */
  save(customer: Customer): Promise<void>;
}
