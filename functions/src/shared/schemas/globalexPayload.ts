import { z } from 'zod';

/**
 * Inbound Globalex webhook payload. The shape mirrors "Our payload template"
 * in docs/globalex-webhook.md EXACTLY — every field in that template is listed
 * here and nothing that is not. Unknown keys are stripped; `""` (Globalex's
 * "field absent") is coerced to `undefined`. See CLAUDE.md §6.
 *
 * Do not add a field here that docs/globalex-webhook.md does not define.
 */

/** Trim strings and treat empty/whitespace-only as absent. */
const emptyToUndefined = (v: unknown): unknown =>
  typeof v === 'string' && v.trim().length === 0 ? undefined : v;

const optStr = z.preprocess(emptyToUndefined, z.string().trim().optional());

export const GLOBALEX_EVENTS = ['ring', 'answer', 'hangup', 'cdr', 'dtmf'] as const;
export const GlobalexEventSchema = z.enum(GLOBALEX_EVENTS);
export type GlobalexEvent = z.infer<typeof GlobalexEventSchema>;

export const DIRECTIONS = ['inbound', 'outbound', 'internal'] as const;
export const DispositionSchema = z.preprocess(
  emptyToUndefined,
  z.enum(['ANSWERED', 'NO ANSWER', 'BUSY', 'FAILED']).optional(),
);

export const GlobalexPayloadSchema = z
  .object({
    event: GlobalexEventSchema,
    call_id: z.string().trim().min(1, 'call_id is required'),
    timestamp: optStr,
    direction: z.preprocess(emptyToUndefined, z.enum(DIRECTIONS).optional()),
    caller_number: optStr,
    caller_name: optStr,
    did_number: optStr,
    destination_number: optStr,
    extension: optStr,
    answering_extension: optStr,
    queue: optStr,
    ring_group: optStr,
    ivr_name: optStr,
    digit: optStr,
    ivr_inputs: optStr,
    starttime: optStr,
    answertime: optStr,
    endtime: optStr,
    duration: optStr,
    talk_time: optStr,
    disposition: DispositionSchema,
    cause_text: optStr,
    application_type: optStr,
    voicemail_box: optStr,
    lastapp: optStr,
    recording_available: optStr,
    recording_play_url: optStr,
    recording_download_url: optStr,
    recording_filename: optStr,
    org_name: optStr,
    client_id: optStr,
    server_id: optStr,
  })
  .strip();

export type GlobalexPayload = z.infer<typeof GlobalexPayloadSchema>;
