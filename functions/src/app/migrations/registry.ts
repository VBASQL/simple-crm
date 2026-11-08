import type { Migration } from './types.js';
import { migration0001Init } from './migrations/0001-init.js';

/**
 * The ordered list of migrations. Append only; never reorder or renumber an
 * id that has shipped (the ledger keys on it).
 */
export const MIGRATIONS: readonly Migration[] = [migration0001Init];
