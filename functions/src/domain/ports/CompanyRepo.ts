import type { Company } from '../companies/types.js';

export interface CompanyRepo {
  /** Resolve the tenant from a DID (stored E.164). Null → unknown DID. */
  resolveByDid(didNumberE164: string): Promise<Company | null>;
  getById(companyId: string): Promise<Company | null>;
  /** Provision a new company document. */
  create(company: Company): Promise<void>;
}
