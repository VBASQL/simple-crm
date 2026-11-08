import { AppError } from '../../shared/AppError.js';

/**
 * Validates the Globalex `X-API-Key` header against the configured keys.
 * Rejects anything that does not match (docs/globalex-webhook.md "Transport",
 * CLAUDE.md §webhook security). A composition-root concern, not domain.
 *
 * Per-company key → company mapping is a follow-up; today the DID in the
 * payload still decides the tenant, so a shared key set is enough to gate.
 */
export class ApiKeyAuth {
  private readonly keys: ReadonlySet<string>;

  constructor(keys: readonly string[]) {
    this.keys = new Set(keys);
  }

  assertApiKey(headerValue: string | undefined): void {
    if (headerValue === undefined || !this.keys.has(headerValue)) {
      throw new AppError('Invalid or missing X-API-Key', 'UNAUTHORIZED');
    }
  }
}
