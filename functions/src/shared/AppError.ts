import { assertNever } from './assertNever.js';

/**
 * The one error type the whole codebase throws. Carries a machine code, a
 * context bag for correlation (callId, companyId, operation), and an optional
 * `cause` so each layer can wrap-and-rethrow without losing the chain.
 * See CLAUDE.md §4.
 */
export type ErrorCode =
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'CONFLICT'
  | 'UPSTREAM'
  | 'INTERNAL';

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly context: Record<string, unknown>;

  constructor(
    message: string,
    code: ErrorCode,
    context: Record<string, unknown> = {},
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'AppError';
    this.code = code;
    this.context = context;
  }
}

/** Narrow any thrown value into an AppError, preserving it as the cause. */
export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  const message = err instanceof Error ? err.message : 'Unknown error';
  return new AppError(message, 'INTERNAL', {}, { cause: err });
}

/** Map an error code to the HTTP status the webhook replies with. */
export function httpStatus(code: ErrorCode): number {
  switch (code) {
    case 'VALIDATION':
      return 400;
    case 'UNAUTHORIZED':
      return 401;
    case 'NOT_FOUND':
      return 404;
    case 'CONFLICT':
      return 409;
    case 'UPSTREAM':
      return 502;
    case 'INTERNAL':
      return 500;
    default:
      return assertNever(code);
  }
}
