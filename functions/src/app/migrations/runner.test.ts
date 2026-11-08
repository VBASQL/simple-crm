import { describe, it, expect } from 'vitest';
import type { Firestore } from 'firebase-admin/firestore';
import { runMigrations } from './runner.js';
import type { Migration, MigrationContext, MigrationStore } from './types.js';
import { FixedClock, NoopLogger } from '../../test/fakes/index.js';

class InMemoryMigrationStore implements MigrationStore {
  readonly applied = new Map<string, Date>();
  async isApplied(id: string): Promise<boolean> {
    return this.applied.has(id);
  }
  async markApplied(id: string, at: Date): Promise<void> {
    this.applied.set(id, at);
  }
}

function ctx(): MigrationContext {
  return {
    db: {} as unknown as Firestore,
    clock: new FixedClock(new Date('2026-11-08T00:00:00Z')),
    logger: new NoopLogger(),
  };
}

function migration(id: string, ran: string[]): Migration {
  return {
    id,
    description: id,
    up: async (): Promise<void> => {
      ran.push(id);
    },
  };
}

describe('runMigrations', () => {
  it('applies pending migrations in order and records them', async () => {
    const ran: string[] = [];
    const store = new InMemoryMigrationStore();
    const summary = await runMigrations([migration('0001', ran), migration('0002', ran)], store, ctx());

    expect(ran).toEqual(['0001', '0002']);
    expect(summary.applied).toEqual(['0001', '0002']);
    expect(summary.skipped).toEqual([]);
    expect([...store.applied.keys()]).toEqual(['0001', '0002']);
  });

  it('is idempotent — a second run applies nothing', async () => {
    const ran: string[] = [];
    const store = new InMemoryMigrationStore();
    const migrations = [migration('0001', ran), migration('0002', ran)];

    await runMigrations(migrations, store, ctx());
    const second = await runMigrations(migrations, store, ctx());

    expect(ran).toEqual(['0001', '0002']); // not run again
    expect(second.applied).toEqual([]);
    expect(second.skipped).toEqual(['0001', '0002']);
  });

  it('aborts and does not ledger a failing migration', async () => {
    const store = new InMemoryMigrationStore();
    const boom: Migration = {
      id: '0001',
      description: 'boom',
      up: (): Promise<void> => Promise.reject(new Error('kaboom')),
    };

    await expect(runMigrations([boom], store, ctx())).rejects.toMatchObject({ code: 'INTERNAL' });
    expect(store.applied.has('0001')).toBe(false);
  });

  it('rejects a duplicate migration id', async () => {
    const ran: string[] = [];
    const store = new InMemoryMigrationStore();
    await expect(
      runMigrations([migration('0001', ran), migration('0001', ran)], store, ctx()),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});
