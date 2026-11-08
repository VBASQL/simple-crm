import type { Firestore } from 'firebase-admin/firestore';

/**
 * The `_migrations` ledger: one document per applied migration id.
 *
 * Structurally satisfies `MigrationStore` (app/migrations/types) without
 * importing it, so infra does not depend on app. The conformance is checked at
 * the call site in app/migrations/run.ts where it is passed to runMigrations.
 */
export class FirestoreMigrationStore {
  constructor(private readonly db: Firestore) {}

  async isApplied(id: string): Promise<boolean> {
    const doc = await this.db.collection('_migrations').doc(id).get();
    return doc.exists;
  }

  async markApplied(id: string, at: Date): Promise<void> {
    await this.db.collection('_migrations').doc(id).set({ appliedAt: at });
  }
}
