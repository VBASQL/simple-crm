import { describe, it, expect } from 'vitest';
import { SecretService } from './SecretService.js';
import { FixedClock, SeqIdGen, InMemorySecretStore } from '../../test/fakes/index.js';

function makeSut(now = new Date('2026-11-09T00:00:00Z')) {
  const store = new InMemorySecretStore();
  const svc = new SecretService(store, new FixedClock(now), new SeqIdGen('tok'));
  return { store, svc };
}

describe('SecretService.reveal', () => {
  it('reveals a sealed secret and returns a claim token (first open)', async () => {
    const { store, svc } = makeSut();
    store.seal('s1', 'super-secret');
    const r = await svc.reveal('s1', undefined);
    expect(r).toEqual({ kind: 'revealed', secret: 'super-secret', claimToken: 'tok-1' });
  });

  it('re-reveals only to the browser holding the claim token', async () => {
    const { store, svc } = makeSut();
    store.seal('s1', 'super-secret');
    const first = await svc.reveal('s1', undefined);
    const token = first.kind === 'revealed' ? first.claimToken : '';

    await expect(svc.reveal('s1', token)).resolves.toMatchObject({ kind: 'revealed', secret: 'super-secret' });
    await expect(svc.reveal('s1', 'wrong')).resolves.toEqual({ kind: 'gone' });
    await expect(svc.reveal('s1', undefined)).resolves.toEqual({ kind: 'gone' });
  });

  it('returns gone for an unknown id', async () => {
    const { svc } = makeSut();
    await expect(svc.reveal('nope', undefined)).resolves.toEqual({ kind: 'gone' });
  });

  it('returns gone for an expired secret', async () => {
    const { store, svc } = makeSut(new Date('2026-11-09T00:00:00Z'));
    store.seal('s1', 'super-secret', new Date('2026-11-08T00:00:00Z'));
    await expect(svc.reveal('s1', undefined)).resolves.toEqual({ kind: 'gone' });
  });

  it('rejects an empty id', async () => {
    const { svc } = makeSut();
    await expect(svc.reveal('  ', undefined)).rejects.toMatchObject({ code: 'VALIDATION' });
  });
});
