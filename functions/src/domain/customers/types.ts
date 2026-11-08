export type CustomerSource = 'phone' | 'email' | 'manual';

/** A customer may start with only a phone or only an email. */
export interface Customer {
  readonly id: string;
  readonly companyId: string;
  readonly name?: string;
  /** All stored E.164. */
  readonly phones: readonly string[];
  readonly emails: readonly string[];
  readonly source: CustomerSource;
  readonly createdAt: Date;
  readonly lastContactAt: Date;
  readonly tags: readonly string[];
  /** Set on the retired record after a merge so old links still resolve. */
  readonly mergedInto?: string;
}
