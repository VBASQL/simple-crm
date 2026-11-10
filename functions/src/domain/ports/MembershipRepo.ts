export interface MembershipRepo {
  /** The company an allow-listed email belongs to, or null if not allow-listed. */
  companyForEmail(email: string): Promise<string | null>;
  /** Every company the email may act in (array + legacy forms); [] if none. */
  companiesForEmail(email: string): Promise<string[]>;
  /** Add a company to the email's membership (used when provisioning one). */
  addCompany(email: string, companyId: string): Promise<void>;
}
