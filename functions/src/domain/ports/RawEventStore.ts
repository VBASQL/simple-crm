import type { GlobalexPayload } from '../../shared/schemas/globalexPayload.js';

export interface RawEventMeta {
  readonly receivedAt: Date;
  readonly reqId: string;
}

/**
 * Durable capture of every inbound webhook event, written BEFORE the 200 ack
 * so nothing is lost if the DID is unmapped or processing fails. The original
 * body is stored verbatim for replay. See CLAUDE.md §6 (idempotent, replayable).
 */
export interface RawEventStore {
  /** Persist the raw body + parsed event; returns the stored document id. */
  capture(rawBody: unknown, event: GlobalexPayload, meta: RawEventMeta): Promise<string>;
  /** Mark an earlier captured event as processed, with the routing outcome. */
  markProcessed(id: string, outcome: Record<string, unknown>): Promise<void>;
}
