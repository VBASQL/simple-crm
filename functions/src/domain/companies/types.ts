/** A tenant. Found from the DID a call arrived on. See docs/build-plan.md. */
export interface Company {
  readonly id: string;
  readonly name: string;
  readonly timezone: string;
  readonly language: 'he' | 'en';
  readonly emailIntakeAddress?: string;
  readonly ticketAutoCloseDays: number;
  readonly retentionMonths: number;
}

/** One dialled number → one company. The webhook's did_number decides tenant. */
export interface Did {
  /** Stored normalised to E.164. */
  readonly number: string;
  readonly companyId: string;
  readonly label?: string;
}
