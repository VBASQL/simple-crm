import { describe, it, expect } from 'vitest';
import { normalizeE164, samePhone } from './phone.js';

describe('normalizeE164 (Israel default)', () => {
  it.each([
    ['+972521234567', '+972521234567'],
    ['0521234567', '+972521234567'],
    ['972521234567', '+972521234567'],
    ['00972521234567', '+972521234567'],
    ['052-123-4567', '+972521234567'],
    ['521234567', '+972521234567'],
    ['  +972 52 123 4567 ', '+972521234567'],
  ])('normalises %s → %s', (input, expected) => {
    expect(normalizeE164(input)).toBe(expected);
  });

  it.each(['', '   ', 'abc', '123'])('returns null for unparseable %s', (input) => {
    expect(normalizeE164(input)).toBeNull();
  });

  it('matches the same person across input formats', () => {
    expect(samePhone('052-123-4567', '+972521234567')).toBe(true);
    expect(samePhone('0521234567', '0539999999')).toBe(false);
  });
});
