import { onRequest } from 'firebase-functions/v2/https';

import { AppError, toAppError, httpStatus } from '../../shared/AppError.js';
import { GlobalexPayloadSchema } from '../../shared/schemas/globalexPayload.js';
import { getContainer } from '../container.js';
import { loadConfig } from '../config.js';

const region = loadConfig().region;

/** Read a string property off an unknown body without tripping unsafe-access. */
function pick(body: unknown, key: string): string | undefined {
  if (typeof body === 'object' && body !== null && key in body) {
    const value = (body as Record<string, unknown>)[key];
    return typeof value === 'string' ? value : undefined;
  }
  return undefined;
}

/**
 * Composition root for the Globalex webhook. It authenticates, validates,
 * acknowledges within 1 s, then runs the one service call and logs exactly
 * one line (info on apply, warn on drop, error on failure). No business logic
 * lives here. See CLAUDE.md §1 and §5.
 */
export const globalexWebhook = onRequest({ region }, async (req, res): Promise<void> => {
  const c = getContainer();
  const body: unknown = req.body;
  const reqId = c.ids.next();
  const log = c.logger.child({ reqId, event: pick(body, 'event'), callId: pick(body, 'call_id') });
  const started = c.clock.now();

  try {
    const apiKey = req.get('x-api-key');
    c.auth.assertApiKey(typeof apiKey === 'string' ? apiKey : undefined);

    const parsed = GlobalexPayloadSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError('Invalid Globalex payload', 'VALIDATION', {
        issueCount: parsed.error.issues.length,
      });
    }

    // Acknowledge before doing the work (docs/globalex-webhook.md: 200 within 1 s).
    res.status(200).end();

    const outcome = await c.callService.handle(parsed.data);
    const ms = c.clock.now().getTime() - started.getTime();
    if (outcome.result === 'ignored') {
      log.warn({ outcome, ms }, 'webhook dropped');
    } else {
      log.info({ outcome, ms }, 'webhook handled');
    }
  } catch (err) {
    const e = toAppError(err);
    log.error({ err: e, code: e.code, ctx: e.context }, 'webhook failed');
    if (!res.headersSent) res.status(httpStatus(e.code)).json({ error: e.code });
  }
});
