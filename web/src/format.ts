import type { Locale } from './i18n/i18n.js';

/** Short date-time in the active locale; empty string when absent. */
export function formatDateTime(date: Date | undefined, locale: Locale): string {
  if (date === undefined) return '';
  return new Intl.DateTimeFormat(locale === 'he' ? 'he-IL' : 'en-GB', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}
