import type { Firestore } from 'firebase-admin/firestore';
import type { CompanyRepo } from '../../domain/ports/CompanyRepo.js';
import type { Company } from '../../domain/companies/types.js';
import { COMPANY_DEFAULTS } from '../../shared/defaults.js';
import { optString } from './mappers.js';

export class FirestoreCompanyRepo implements CompanyRepo {
  constructor(private readonly db: Firestore) {}

  async resolveByDid(didNumberE164: string): Promise<Company | null> {
    const snap = await this.db.collection('dids').where('number', '==', didNumberE164).limit(1).get();
    const didDoc = snap.docs[0];
    if (didDoc === undefined) return null;
    const companyId = optString(didDoc.get('companyId'));
    if (companyId === undefined) return null;
    return this.getById(companyId);
  }

  async create(company: Company): Promise<void> {
    await this.db.collection('companies').doc(company.id).set({
      name: company.name,
      timezone: company.timezone,
      language: company.language,
      ticketAutoCloseDays: company.ticketAutoCloseDays,
      retentionMonths: company.retentionMonths,
      ...(company.emailIntakeAddress !== undefined ? { emailIntakeAddress: company.emailIntakeAddress } : {}),
    });
  }

  async getById(companyId: string): Promise<Company | null> {
    const doc = await this.db.collection('companies').doc(companyId).get();
    if (!doc.exists) return null;
    return this.map(companyId, doc.data() ?? {});
  }

  private map(id: string, data: Record<string, unknown>): Company {
    const language = data.language === 'en' ? 'en' : 'he';
    return {
      id,
      name: optString(data.name) ?? '',
      timezone: optString(data.timezone) ?? COMPANY_DEFAULTS.timezone,
      language,
      ticketAutoCloseDays:
        typeof data.ticketAutoCloseDays === 'number' ? data.ticketAutoCloseDays : COMPANY_DEFAULTS.ticketAutoCloseDays,
      retentionMonths:
        typeof data.retentionMonths === 'number' ? data.retentionMonths : COMPANY_DEFAULTS.retentionMonths,
      ...(optString(data.emailIntakeAddress) !== undefined
        ? { emailIntakeAddress: optString(data.emailIntakeAddress) as string }
        : {}),
    };
  }
}
