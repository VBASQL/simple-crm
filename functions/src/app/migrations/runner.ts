import { AppError } from '../../shared/AppError.js';
import type { Migration, MigrationContext, MigrationStore, MigrationSummary } from './types.js';

/**
 * Runs pending migrations in registry order. Each is applied at most once:
 * already-ledgered ids are skipped, so a re-run after a half-finished deploy is
 * safe. A migration that throws aborts the run (CLAUDE.md §4 — throw up); the
 * ledger is written only after `up` succeeds, so the failed one re-runs next
 * time. Returns a summary for the composition root to log once.
 */
export async function runMigrations(
  migrations: readonly Migration[],
  store: MigrationStore,
  ctx: MigrationContext,
): Promise<MigrationSummary> {
  const seen = new Set<string>();
  const applied: string[] = [];
  const skipped: string[] = [];

  for (const migration of migrations) {
    if (seen.has(migration.id)) {
      throw new AppError('Duplicate migration id', 'CONFLICT', { id: migration.id });
    }
    seen.add(migration.id);

    if (await store.isApplied(migration.id)) {
      skipped.push(migration.id);
      continue;
    }

    try {
      await migration.up(ctx);
    } catch (err) {
      throw new AppError('Migration failed', 'INTERNAL', { id: migration.id }, { cause: err });
    }
    await store.markApplied(migration.id, ctx.clock.now());
    applied.push(migration.id);
  }

  return { applied, skipped };
}
