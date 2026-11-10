import { z } from 'zod';

/**
 * Inbound Globalex webhook payload. Globalex is the PROVIDER: we parse whatever
 * their published webhook sends. Every field and its aliases come from
 * docs/globalex-webhook.md (sourced from Globalex's public webhook docs); we map
 * their native field names onto our canonical keys so their standard payload is
 * accepted without a bespoke template. `""` (their "field absent") → undefined;
 * unknown keys are dropped. See CLAUDE.md §6.
 *
 * Do not add a field or alias that docs/globalex-webhook.md does not list.
 */

/** Canonical key → the field names Globalex may send for it (first match wins). */
const ALIASES: Readonly<Record<string, readonly string[]>> = {
  call_id: ['call_id', 'uniqueid', 'root_uniqueid'],
  direction: ['direction', 'call_direction'],
  caller_number: ['caller_number', 'calleridnum', 'src', 'source'],
  caller_name: ['caller_name', 'calleridname'],
  did_number: ['did_number', 'did', 'DID_number'],
  destination_number: ['destination_number_clean', 'destination_number', 'destination', 'dst', 'dest_number'],
  extension: ['extension', 'exten'],
  answering_extension: ['answering_extension', 'answeringExtension', 'answered_extension'],
  queue: ['queue', 'queueName', 'Queue'],
  ring_group: ['ring_group', 'ringGroupName', 'ringgroup', 'RingGroup'],
  ivr_name: ['ivr_name', 'ivrName'],
  ivr_inputs: ['ivr_inputs', 'ivr_inputs_json'],
  starttime: ['starttime', 'start_time'],
  answertime: ['answertime', 'answer_time'],
  endtime: ['endtime', 'end_time'],
  talk_time: ['talk_time', 'billsec', 'billableseconds'],
  cause_text: ['cause_text', 'cause-txt'],
  application_type: ['application_type', 'applicationType'],
  voicemail_box: ['voicemail_box', 'voicemailBox'],
  lastapp: ['lastapp', 'lastapplication'],
  recording_play_url: ['recording_play_url', 'recording_url'],
  org_name: ['org_name', 'organization', 'domain'],
  server_id: ['server_id', 'serverId'],
};

/** Canonical keys with no documented alias; passed through as-is. */
const PASSTHROUGH: readonly string[] = [
  'event',
  'timestamp',
  'digit',
  'duration',
  'disposition',
  'recording_available',
  'recording_download_url',
  'recording_filename',
  'client_id',
  // Outbound caller id — the line a call was placed on. Used to resolve the
  // tenant for outbound calls (did_number is inbound-only). CDR only.
  'callerid',
  'outbound_callerid',
];

const isPresent = (v: unknown): boolean => !(v === undefined || (typeof v === 'string' && v.trim().length === 0));

/** Map Globalex's native field names onto our canonical keys before validation. */
function remapAliases(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null) return raw;
  const src = raw as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [canonical, names] of Object.entries(ALIASES)) {
    for (const name of names) {
      if (isPresent(src[name])) {
        out[canonical] = src[name];
        break;
      }
    }
  }
  for (const key of PASSTHROUGH) {
    if (out[key] === undefined && src[key] !== undefined) out[key] = src[key];
  }
  return out;
}

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

const GlobalexFields = z
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
    callerid: optStr,
    outbound_callerid: optStr,
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

/** Alias-tolerant parser: accepts Globalex's native field names. */
export const GlobalexPayloadSchema = z.preprocess(remapAliases, GlobalexFields);

export type GlobalexPayload = z.infer<typeof GlobalexPayloadSchema>;
