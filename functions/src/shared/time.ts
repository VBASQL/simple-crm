/**
 * Parse Globalex time fields to a UTC `Date` at the boundary (CLAUDE.md §6).
 *
 * We request ISO 8601 with the client offset for every time field, so those
 * parse directly. The provider's default mix can still send a bare wall-clock
 * `YYYY-MM-DD HH:MM:SS`; for that form the caller supplies the zone offset
 * (minutes east of UTC) it should be read in. Returns null on anything else.
 */
export function parseGlobalexTime(raw: string, wallClockOffsetMinutes = 0): Date | null {
  const s = raw.trim();
  if (s.length === 0) return null;

  // ISO 8601 carrying its own zone (trailing Z or ±HH:MM / ±HHMM).
  if (/(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(s)) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  // Bare wall-clock in a known offset.
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/.exec(s);
  if (m) {
    const utcMs =
      Date.UTC(
        Number(m[1]),
        Number(m[2]) - 1,
        Number(m[3]),
        Number(m[4]),
        Number(m[5]),
        Number(m[6]),
      ) -
      wallClockOffsetMinutes * 60_000;
    return Number.isNaN(utcMs) ? null : new Date(utcMs);
  }

  return null;
}
