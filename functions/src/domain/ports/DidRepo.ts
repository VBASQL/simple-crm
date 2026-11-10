import type { Did } from '../companies/types.js';

export interface DidRepo {
  /** All DIDs mapped to a company. */
  listByCompany(companyId: string): Promise<Did[]>;
  /** A single DID by its E.164 number, across all companies (null → unmapped). */
  getByNumber(numberE164: string): Promise<Did | null>;
  /** Create or replace a DID mapping (idempotent, keyed by the E.164 number). */
  upsert(did: Did): Promise<void>;
  delete(numberE164: string): Promise<void>;
}
