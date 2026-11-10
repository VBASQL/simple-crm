import { onCall, HttpsError, type FunctionsErrorCode } from 'firebase-functions/v2/https';

import { AppError, toAppError, type ErrorCode } from '../../shared/AppError.js';
import { assertNever } from '../../shared/assertNever.js';
import { getContainer } from '../container.js';
import { loadConfig } from '../config.js';
import type { Did } from '../../domain/companies/types.js';

const region = loadConfig().region;

/** Map our error codes onto callable error codes for the client. */
function callableCode(code: ErrorCode): FunctionsErrorCode {
  switch (code) {
    case 'VALIDATION':
      return 'invalid-argument';
    case 'NOT_FOUND':
      return 'not-found';
    case 'UNAUTHORIZED':
      return 'permission-denied';
    case 'CONFLICT':
      return 'already-exists';
    case 'UPSTREAM':
      return 'unavailable';
    case 'INTERNAL':
      return 'internal';
    default:
      return assertNever(code);
  }
}

function str(data: unknown, key: string): string | undefined {
  if (typeof data === 'object' && data !== null && key in data) {
    const v = (data as Record<string, unknown>)[key];
    return typeof v === 'string' ? v : undefined;
  }
  return undefined;
}

/**
 * Add or remove a DID for the caller's company. The company is derived from the
 * authenticated email via the allow-list — never from the client — so a user can
 * only manage their own tenant's DIDs. All the logic is in DidService (numbers
 * are normalised to E.164 there); this root only authenticates and dispatches.
 */
export const manageDid = onCall({ region }, async (request): Promise<{ ok: true; did?: Did }> => {
  const c = getContainer();
  const log = c.logger.child({ reqId: c.ids.next(), fn: 'manageDid' });

  const email = request.auth?.token.email;
  if (typeof email !== 'string') throw new HttpsError('unauthenticated', 'Sign in required');
  const companyId = await c.membership.companyForEmail(email);
  if (companyId === null) throw new HttpsError('permission-denied', 'Not on the allow-list');

  const action = str(request.data, 'action');
  const number = str(request.data, 'number');
  const label = str(request.data, 'label');

  try {
    if (number === undefined) throw new AppError('number is required', 'VALIDATION');
    if (action === 'add') {
      const did = await c.didService.add(companyId, number, label);
      return { ok: true, did };
    }
    if (action === 'remove') {
      await c.didService.remove(companyId, number);
      return { ok: true };
    }
    throw new AppError('Unknown action', 'VALIDATION', { action });
  } catch (err) {
    const e = toAppError(err);
    log.error({ err: e, code: e.code, ctx: e.context }, 'manageDid failed');
    throw new HttpsError(callableCode(e.code), e.code);
  }
});
