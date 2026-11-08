/**
 * Per-company config knobs have Firestore defaults here; never hard-code them
 * elsewhere. A company document may override any of these. See CLAUDE.md §8.
 */
export const COMPANY_DEFAULTS = {
  /** Open tickets auto-close after this many days with no activity. */
  ticketAutoCloseDays: 14,
  /** Recordings / voicemail retained this many months, then deleted. */
  retentionMonths: 12,
  /** Default UI language for a new user in the company. */
  language: 'he' as 'he' | 'en',
  /** Company wall-clock zone for display (storage is always UTC). */
  timezone: 'Asia/Jerusalem',
  /** A ringing doc with no hangup is swept after this many seconds. */
  ringingTtlSeconds: 120,
} as const;

/** The E.164 country used when a local Israel number arrives without one. */
export const DEFAULT_COUNTRY_CODE = '972';
