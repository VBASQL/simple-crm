import type { FileStore, StoredFile } from '../../domain/ports/FileStore.js';
import { AppError } from '../../shared/AppError.js';

/**
 * Phase 2 (docs/build-plan.md "Audio"). Copies Globalex recordings into
 * company-scoped Cloud Storage and mints signed URLs. Not yet implemented;
 * the webhook path does not depend on it.
 */
export class GcsFileStore implements FileStore {
  constructor(private readonly bucket: string) {}

  copyFromUrl(_sourceUrl: string, _destPath: string): Promise<StoredFile> {
    throw new AppError('GcsFileStore.copyFromUrl not implemented', 'INTERNAL', { bucket: this.bucket });
  }

  signedUrl(_path: string, _ttlSeconds: number): Promise<string> {
    throw new AppError('GcsFileStore.signedUrl not implemented', 'INTERNAL', { bucket: this.bucket });
  }
}
