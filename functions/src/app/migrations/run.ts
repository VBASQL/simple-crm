import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

import { toAppError } from '../../shared/AppError.js';
import { SystemClock } from '../../infra/system/SystemClock.js';
import { PinoLogger } from '../../infra/system/PinoLogger.js';
import { FirestoreMigrationStore } from '../../infra/firestore/FirestoreMigrationStore.js';
import { loadConfig } from '../config.js';
import { MIGRATIONS } from './registry.js';
import { runMigrations } from './runner.js';

/**
 * CD entrypoint: `node lib/app/migrations/run.js`. Runs pending migrations
 * against whatever project the ambient credentials point at (the emulator
 * when FIRESTORE_EMULATOR_HOST is set, else the real project). Logs exactly
 * one line on success and one on failure (CLAUDE.md §5).
 */
async function main(): Promise<void> {
  const cfg = loadConfig();
  if (getApps().length === 0) initializeApp();
  const db = getFirestore();
  db.settings({ ignoreUndefinedProperties: true });

  const logger = new PinoLogger(cfg.logLevel);
  const clock = new SystemClock();
  const store = new FirestoreMigrationStore(db);

  const summary = await runMigrations(MIGRATIONS, store, { db, clock, logger });
  logger.info({ applied: summary.applied, skipped: summary.skipped }, 'migrations complete');
}

// Composition root: the single place that catches, logs once, and sets exit code.
void main().catch((err: unknown) => {
  const e = toAppError(err);
  new PinoLogger().error({ err: e, code: e.code, ctx: e.context }, 'migrations failed');
  process.exitCode = 1;
});
