import { AppError } from '../../shared/AppError.js';
import type { Did } from '../companies/types.js';
import type { DidRepo } from '../ports/DidRepo.js';
import type { PhoneNormalizer } from '../customers/PhoneNormalizer.js';

/**
 * Manages the DID → company mapping that scopes every inbound call to a tenant.
 * All writes go through here (never raw client writes) so the number is always
 * stored E.164 — the exact form CompanyRepo.resolveByDid looks up. A DID belongs
 * to exactly one company (build plan "one DID → one company").
 */
export class DidService {
  constructor(
    private readonly dids: DidRepo,
    private readonly phones: PhoneNormalizer,
  ) {}

  list(companyId: string): Promise<Did[]> {
    return this.dids.listByCompany(companyId);
  }

  async add(companyId: string, rawNumber: string, label?: string): Promise<Did> {
    const number = this.phones.normalize(rawNumber);
    if (number === null) {
      throw new AppError('Not a valid phone number', 'VALIDATION', { rawNumber });
    }
    // A DID can map to one company only; adding one owned elsewhere is a conflict,
    // not a silent re-assignment (it would hijack another tenant's calls).
    const existing = await this.dids.getByNumber(number);
    if (existing !== null && existing.companyId !== companyId) {
      throw new AppError('DID already mapped to another company', 'CONFLICT', { number });
    }
    const did: Did = { number, companyId, ...(label !== undefined && label !== '' ? { label } : {}) };
    await this.dids.upsert(did);
    return did;
  }

  async remove(companyId: string, rawNumber: string): Promise<void> {
    const number = this.phones.normalize(rawNumber);
    if (number === null) throw new AppError('Not a valid phone number', 'VALIDATION', { rawNumber });

    const existing = await this.dids.getByNumber(number);
    if (existing === null) return; // already gone — idempotent
    if (existing.companyId !== companyId) {
      throw new AppError('DID belongs to another company', 'UNAUTHORIZED', { number });
    }
    await this.dids.delete(number);
  }
}
