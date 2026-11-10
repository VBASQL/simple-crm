import { AppError } from '../../shared/AppError.js';
import { COMPANY_DEFAULTS } from '../../shared/defaults.js';
import type { CompanyRepo } from '../ports/CompanyRepo.js';
import type { MembershipRepo } from '../ports/MembershipRepo.js';
import type { IdGen } from '../ports/IdGen.js';
import type { Company } from './types.js';

/**
 * Creates a new company and makes its creator a member in one step, so an
 * operator can add a client company from the UI without leaving someone locked
 * out of what they just made. Pure: all I/O is through injected ports.
 */
export class CompanyProvisioningService {
  constructor(
    private readonly companies: CompanyRepo,
    private readonly members: MembershipRepo,
    private readonly ids: IdGen,
  ) {}

  async create(ownerEmail: string, rawName: string): Promise<Company> {
    const name = rawName.trim();
    if (name.length === 0) throw new AppError('Company name is required', 'VALIDATION');

    // New companies start from the shared defaults; the owner edits them on the
    // settings screen afterwards. Config knobs are never hard-coded elsewhere.
    const company: Company = {
      id: this.ids.next(),
      name,
      timezone: COMPANY_DEFAULTS.timezone,
      language: COMPANY_DEFAULTS.language,
      ticketAutoCloseDays: COMPANY_DEFAULTS.ticketAutoCloseDays,
      retentionMonths: COMPANY_DEFAULTS.retentionMonths,
    };
    await this.companies.create(company);
    // Grant the creator access, or they could not open what they just created.
    await this.members.addCompany(ownerEmail, company.id);
    return company;
  }
}
