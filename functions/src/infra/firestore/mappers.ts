import { Timestamp } from 'firebase-admin/firestore';

/** Firestore returns Timestamp for date fields; coerce to JS Date on read. */
export function toDate(value: unknown): Date | undefined {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  return undefined;
}

/** Require a date field that must be present, else fail loudly. */
export function requireDate(value: unknown, field: string): Date {
  const d = toDate(value);
  if (d === undefined) throw new Error(`Expected a timestamp for field "${field}"`);
  return d;
}

export function optString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}
