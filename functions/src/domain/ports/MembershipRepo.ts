export interface MembershipRepo {
  /** The company an allow-listed email belongs to, or null if not allow-listed. */
  companyForEmail(email: string): Promise<string | null>;
}
