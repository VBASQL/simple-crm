import type { Call } from '../calls/types.js';

export interface CallRepo {
  get(callId: string): Promise<Call | null>;
  /** Merge by call_id; must be idempotent (CLAUDE.md §6). */
  upsert(call: Call): Promise<void>;
}
