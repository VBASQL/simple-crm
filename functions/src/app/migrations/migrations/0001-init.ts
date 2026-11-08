import type { Migration } from '../types.js';

/**
 * Baseline marker. Records that the migration ledger exists; makes no data
 * change. Real backfills are added as later numbered migrations and, per
 * CLAUDE.md §8, ship alongside the type/schema/fixture changes they support.
 */
export const migration0001Init: Migration = {
  id: '0001-init',
  description: 'Baseline marker; establishes the migration ledger. No data change.',
  up: (): Promise<void> => Promise.resolve(),
};
