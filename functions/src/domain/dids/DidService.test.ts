import { describe, it, expect } from 'vitest';
import { DidService } from './DidService.js';
import { PhoneNormalizer } from '../customers/PhoneNormalizer.js';
import { InMemoryDidRepo } from '../../test/fakes/index.js';

function makeSut() {
  const dids = new InMemoryDidRepo();
  const svc = new DidService(dids, new PhoneNormalizer());
  return { dids, svc };
}

describe('DidService', () => {
  it('normalises to E.164 on add (so resolveByDid matches)', async () => {
    const { dids, svc } = makeSut();
    const did = await svc.add('co-1', '03-765-4321', 'Main line');
    expect(did.number).toBe('+97237654321');
    expect(did.label).toBe('Main line');
    expect(await dids.getByNumber('+97237654321')).not.toBeNull();
  });

  it('rejects an unparseable number', async () => {
    const { svc } = makeSut();
    await expect(svc.add('co-1', 'abc', undefined)).rejects.toMatchObject({ code: 'VALIDATION' });
  });

  it('is idempotent for the same company, and updates the label', async () => {
    const { dids, svc } = makeSut();
    await svc.add('co-1', '037654321');
    await svc.add('co-1', '037654321', 'Support');
    const list = await dids.listByCompany('co-1');
    expect(list).toHaveLength(1);
    expect(list[0]?.label).toBe('Support');
  });

  it('refuses a DID already mapped to another company', async () => {
    const { svc } = makeSut();
    await svc.add('co-1', '037654321');
    await expect(svc.add('co-2', '037654321')).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('removes a DID the company owns, and is idempotent when absent', async () => {
    const { dids, svc } = makeSut();
    await svc.add('co-1', '037654321');
    await svc.remove('co-1', '03-765-4321');
    expect(await dids.getByNumber('+97237654321')).toBeNull();
    await expect(svc.remove('co-1', '037654321')).resolves.toBeUndefined();
  });

  it('refuses to remove another company\'s DID', async () => {
    const { svc } = makeSut();
    await svc.add('co-1', '037654321');
    await expect(svc.remove('co-2', '037654321')).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });
});
