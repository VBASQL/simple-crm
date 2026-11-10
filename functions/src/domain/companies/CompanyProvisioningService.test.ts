import { describe, it, expect } from 'vitest';
import { CompanyProvisioningService } from './CompanyProvisioningService.js';
import { InMemoryCompanyRepo, InMemoryMembershipRepo } from '../../test/fakes/index.js';

class SeqIds {
  private n = 0;
  next(): string {
    this.n += 1;
    return `co-new-${this.n}`;
  }
}

function makeSut() {
  const companies = new InMemoryCompanyRepo();
  const members = new InMemoryMembershipRepo().seed('owner@co.com', 'co-1');
  const svc = new CompanyProvisioningService(companies, members, new SeqIds());
  return { svc, companies, members };
}

describe('CompanyProvisioningService', () => {
  it('creates a company with defaults and adds the creator as a member', async () => {
    const { svc, companies, members } = makeSut();
    const company = await svc.create('owner@co.com', '  Globex  ');

    expect(company.id).toBe('co-new-1');
    expect(company.name).toBe('Globex'); // trimmed
    expect(company.ticketAutoCloseDays).toBe(14); // default
    expect(await companies.getById('co-new-1')).not.toBeNull();
    // The creator now belongs to both their original and the new company.
    expect(await members.companiesForEmail('owner@co.com')).toEqual(['co-1', 'co-new-1']);
  });

  it('rejects a blank name', async () => {
    const { svc } = makeSut();
    await expect(svc.create('owner@co.com', '   ')).rejects.toMatchObject({ code: 'VALIDATION' });
  });
});
