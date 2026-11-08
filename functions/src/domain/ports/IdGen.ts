/** Generates ids for new records; never call crypto.randomUUID() in domain. */
export interface IdGen {
  next(): string;
}
