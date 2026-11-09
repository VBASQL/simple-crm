import type { RevealResult } from '../secrets/types.js';

export interface SecretStore {
  /**
   * Atomically reveal a one-time secret and consume it on the first open.
   * A sealed secret is revealed and stamped with `newToken` (returned to the
   * opener's browser). An already-opened secret is revealed again only to the
   * browser that presents the matching `claimToken`; everyone else gets `gone`.
   */
  revealAndConsume(
    id: string,
    claimToken: string | undefined,
    now: Date,
    newToken: string,
  ): Promise<RevealResult>;
}
