import { normalizeE164 } from '../../shared/phone.js';
import { DEFAULT_COUNTRY_CODE } from '../../shared/defaults.js';

/**
 * Domain wrapper around the shared E.164 normaliser, bound to a company's
 * default country. Inject it where customer matching happens so no caller
 * compares raw phone strings (CLAUDE.md §6).
 */
export class PhoneNormalizer {
  constructor(private readonly defaultCountryCode: string = DEFAULT_COUNTRY_CODE) {}

  /** Returns E.164 or null when the input cannot form a valid number. */
  normalize(raw: string): string | null {
    return normalizeE164(raw, this.defaultCountryCode);
  }
}
