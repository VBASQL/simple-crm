import type { Locale } from './i18n/i18n.js';

const tag = (locale: Locale): string => (locale === 'he' ? 'he-IL' : 'en-GB');

/** Short date-time in the active locale; empty string when absent. */
export function formatDateTime(date: Date | undefined, locale: Locale): string {
  if (date === undefined) return '';
  return new Intl.DateTimeFormat(tag(locale), { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

/** Compact relative time, e.g. "2h", "3d", "just now". */
export function relativeTime(date: Date | undefined, locale: Locale): string {
  if (date === undefined) return '';
  const diffMs = date.getTime() - Date.now();
  const rtf = new Intl.RelativeTimeFormat(tag(locale), { numeric: 'auto', style: 'short' });
  const mins = Math.round(diffMs / 60000);
  const abs = Math.abs(mins);
  if (abs < 1) return locale === 'he' ? 'עכשיו' : 'now';
  if (abs < 60) return rtf.format(mins, 'minute');
  const hours = Math.round(mins / 60);
  if (Math.abs(hours) < 24) return rtf.format(hours, 'hour');
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return rtf.format(days, 'day');
  return formatDateTime(date, locale);
}

/** Up-to-two-letter initials for an avatar. */
export function initials(name: string | undefined, fallback = '?'): string {
  const n = (name ?? '').trim();
  if (n.length === 0) return fallback;
  const parts = n.split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const second = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + second).toUpperCase();
}

/** Deterministic hue (0–359) from a string, for avatar tinting. */
export function hueFrom(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return h;
}
