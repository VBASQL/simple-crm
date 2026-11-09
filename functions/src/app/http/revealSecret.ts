import { onRequest } from 'firebase-functions/v2/https';

import { AppError, toAppError, httpStatus } from '../../shared/AppError.js';
import { getContainer } from '../container.js';
import { loadConfig } from '../config.js';

const region = loadConfig().region;

function pick(body: unknown, key: string): string | undefined {
  if (typeof body === 'object' && body !== null && key in body) {
    const value = (body as Record<string, unknown>)[key];
    return typeof value === 'string' ? value : undefined;
  }
  return undefined;
}

/**
 * Public reveal endpoint for one-time secrets. Reveals + consumes on first open;
 * returns the secret again only to the browser holding the claim token. No auth
 * (the id is an unguessable uuid); thin root, logic in SecretService.
 */
export const revealSecret = onRequest({ region, cors: false }, async (req, res): Promise<void> => {
  const c = getContainer();
  const log = c.logger.child({ reqId: c.ids.next(), fn: 'revealSecret' });
  try {
    const body: unknown = req.body;
    const id = pick(body, 'id');
    if (id === undefined) throw new AppError('id is required', 'VALIDATION');
    const result = await c.secretService.reveal(id, pick(body, 'claimToken'));
    if (result.kind === 'revealed') {
      res.status(200).json({ secret: result.secret, claimToken: result.claimToken });
    } else {
      res.status(410).json({ status: 'gone' });
    }
  } catch (err) {
    const e = toAppError(err);
    log.error({ err: e, code: e.code }, 'revealSecret failed');
    if (!res.headersSent) res.status(httpStatus(e.code)).json({ error: e.code });
  }
});
