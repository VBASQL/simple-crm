import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';

import { AppError, toAppError, httpStatus } from '../../shared/AppError.js';
import { GlobalexPayloadSchema } from '../../shared/schemas/globalexPayload.js';
import { getContainer } from '../container.js';
import { loadConfig } from '../config.js';

const region = loadConfig().region;

// Accepted X-API-Key value(s), comma-separated, stored in Secret Manager.
// Set it with: firebase functions:secrets:set GLOBALEX_API_KEYS
// Its value is injected into process.env.GLOBALEX_API_KEYS at runtime, which
// loadConfig() reads. See docs/globalex-webhook.md "Transport".
const GLOBALEX_API_KEYS = defineSecret('GLOBALEX_API_KEYS');

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
export const globalexWebhook = onRequest(
  { region, secrets: [GLOBALEX_API_KEYS], cors: false },
  async (req, res): Promise<void> => {
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

    // Durably capture the raw event BEFORE acking, so nothing is lost even for
    // an unmapped DID or if processing later fails (it is replayable).
    const rawId = await c.rawEvents.capture(body, parsed.data, { receivedAt: started, reqId });

    // Acknowledge before doing the work (docs/globalex-webhook.md: 200 within 1 s).
    res.status(200).end();

    const outcome = await c.callService.handle(parsed.data);
    await c.rawEvents.markProcessed(rawId, {
      result: outcome.result,
      reason: outcome.reason ?? null,
      companyId: outcome.companyId ?? null,
    });
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
  },
);
