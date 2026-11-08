export interface StoredFile {
  readonly path: string;
}

export interface FileStore {
  /**
   * Copy a remote file (e.g. a Globalex recording URL) into company-scoped
   * storage and return its path. Phase 2.
   */
  copyFromUrl(sourceUrl: string, destPath: string): Promise<StoredFile>;
  /** A short-lived signed URL for a stored object. */
  signedUrl(path: string, ttlSeconds: number): Promise<string>;
}
