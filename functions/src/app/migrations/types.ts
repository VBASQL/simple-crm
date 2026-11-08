import type { Firestore } from 'firebase-admin/firestore';
import type { Clock } from '../../domain/ports/Clock.js';
import type { Logger } from '../../domain/ports/Logger.js';

/** What a migration is handed when it runs. Migrations are app/infra concerns. */
export interface MigrationContext {
  readonly db: Firestore;
  readonly clock: Clock;
  readonly logger: Logger;
}

/** One ordered, idempotent schema/data change. */
export interface Migration {
  /** Stable, unique, sortable id, e.g. `0001-init`. Never reused or renumbered. */
  readonly id: string;
  readonly description: string;
  up(ctx: MigrationContext): Promise<void>;
}

/** Records which migrations have already been applied (the `_migrations` ledger). */
export interface MigrationStore {
  isApplied(id: string): Promise<boolean>;
  markApplied(id: string, at: Date): Promise<void>;
}

export interface MigrationSummary {
  readonly applied: readonly string[];
  readonly skipped: readonly string[];
}
