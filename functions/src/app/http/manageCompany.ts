import { onCall, HttpsError, type FunctionsErrorCode } from 'firebase-functions/v2/https';

import { toAppError, type ErrorCode } from '../../shared/AppError.js';
import { assertNever } from '../../shared/assertNever.js';
import { getContainer } from '../container.js';
import { loadConfig } from '../config.js';
import type { Company } from '../../domain/companies/types.js';

const region = loadConfig().region;

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
 * Create a new company for the signed-in operator, who must already be
 * allow-listed (a member of at least one company). The creator is added to the
 * new company in the same step. All logic is in CompanyProvisioningService;
 * this root only authenticates and dispatches.
 */
export const manageCompany = onCall(
  { region },
  async (request): Promise<{ ok: true; company: Company }> => {
    const c = getContainer();
    const log = c.logger.child({ reqId: c.ids.next(), fn: 'manageCompany' });

    const email = request.auth?.token.email;
    if (typeof email !== 'string') throw new HttpsError('unauthenticated', 'Sign in required');
    // Only an existing member may provision a company — not any signed-in user.
    const companies = await c.membership.companiesForEmail(email);
    if (companies.length === 0) throw new HttpsError('permission-denied', 'Not on the allow-list');

    const action = str(request.data, 'action') ?? 'create';
    const name = str(request.data, 'name');

    try {
      if (action !== 'create') throw new HttpsError('invalid-argument', 'Unknown action');
      const company = await c.companyProvisioning.create(email, name ?? '');
      log.info({ companyId: company.id }, 'company created');
      return { ok: true, company };
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      const e = toAppError(err);
      log.error({ err: e, code: e.code, ctx: e.context }, 'manageCompany failed');
      throw new HttpsError(callableCode(e.code), e.code);
    }
  },
);
