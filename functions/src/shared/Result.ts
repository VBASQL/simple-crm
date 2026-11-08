import type { AppError } from './AppError.js';

/**
 * A typed success/failure value for expected, non-exceptional outcomes
 * (e.g. an out-of-order event that is legitimately ignored). Unexpected
 * failures still throw AppError — Result is not a way to swallow errors.
 * See CLAUDE.md §4.
 */
export type Result<T, E = AppError> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}
