import { AppError } from '../../shared/AppError.js';

/**
 * Phase 2. Fetches a recording from a Globalex URL so it can be copied into
 * Cloud Storage. Globalex auth/expiry on these URLs is an open question
 * (docs/globalex-webhook.md "Known gaps"); do not build on it until confirmed.
 */
export class FetchRecordingClient {
  fetch(_url: string): Promise<ArrayBuffer> {
    throw new AppError('FetchRecordingClient.fetch not implemented', 'UPSTREAM');
  }
}
