import { DEFAULT_COUNTRY_CODE } from './defaults.js';

/**
 * Normalise a raw phone string to E.164 (e.g. +972521234567) so the same
 * person matches whether Globalex sends `052…`, `972…`, `+972…` or `0…`.
 * Returns null when the input cannot form a plausible E.164 number; callers
 * decide what an unmatchable number means (never compare raw strings — see
 * CLAUDE.md §6). This is the single source of truth; domain/customers wraps it.
 */
export function normalizeE164(
  raw: string,
  defaultCountryCode: string = DEFAULT_COUNTRY_CODE,
): string | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;

  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 0) return null;

  let e164Digits: string;
  if (hasPlus) {
    // Already international: the digits include the country code.
    e164Digits = digits;
  } else if (digits.startsWith('00')) {
    // International access prefix: 00 <cc> <number>.
    e164Digits = digits.slice(2);
  } else if (digits.startsWith(defaultCountryCode)) {
    // Country code without a plus, e.g. 972521234567.
    e164Digits = digits;
  } else if (digits.startsWith('0')) {
    // National format with trunk prefix, e.g. 0521234567.
    e164Digits = defaultCountryCode + digits.slice(1);
  } else {
    // Bare local number, assume the default country.
    e164Digits = defaultCountryCode + digits;
  }

  // E.164 allows up to 15 digits; require enough to be a real number.
  if (e164Digits.length < 8 || e164Digits.length > 15) return null;

  return `+${e164Digits}`;
}

/** True when two raw numbers resolve to the same E.164 value. */
export function samePhone(a: string, b: string, defaultCountryCode?: string): boolean {
  const na = normalizeE164(a, defaultCountryCode);
  const nb = normalizeE164(b, defaultCountryCode);
  return na !== null && na === nb;
}
