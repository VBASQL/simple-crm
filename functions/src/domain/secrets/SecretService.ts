import { AppError } from '../../shared/AppError.js';
import type { Clock } from '../ports/Clock.js';
import type { IdGen } from '../ports/IdGen.js';
import type { SecretStore } from '../ports/SecretStore.js';
import type { RevealResult } from './types.js';

/**
 * One-time-secret reveal. Generates the per-open claim token and delegates the
 * atomic reveal/consume to the store. No persistence logic lives here.
 */
export class SecretService {
  constructor(
    private readonly store: SecretStore,
    private readonly clock: Clock,
    private readonly ids: IdGen,
  ) {}

  async reveal(id: string, claimToken: string | undefined): Promise<RevealResult> {
    if (id.trim().length === 0) throw new AppError('Secret id is required', 'VALIDATION');
    return this.store.revealAndConsume(id, claimToken, this.clock.now(), this.ids.next());
  }
}
