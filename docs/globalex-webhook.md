# Globalex VoIP Monitor — Webhook API Reference

External contract: what Globalex sends to this system. Source:
https://alert.globalex.co.il/webhook-docs (public reference, no auth).
Globalex configures the endpoint on their side from the template under
"Our payload template"; we never call Globalex, they call us.
Keep this file in sync with that page; it is the only place field names
and event semantics are allowed to be defined in this repo.


Source: https://alert.globalex.co.il/webhook-docs (public reference, no auth).
Globalex configures the endpoint on their side from a template we give them.
We never call Globalex; they call us.

## Transport

| Item | Value |
| --- | --- |
| Direction | Globalex → our HTTPS endpoint |
| Formats | JSON or XML body; POST (body) or GET (fields in query string). **We use JSON over POST.** |
| Content-Type | `application/json` |
| Auth | API key in a header; default header name `X-API-Key`; header name, header/query placement and per-client value are all configurable on their side |
| Retry (optional, off by default) | On 429 or 5xx: up to 3 attempts total, waits 2 s then 8 s, or honours `Retry-After` up to 60 s. **Never retries on timeout.** |
| Dedup | Identical payload for the same call within 5 s is sent once (all events except CDR) |
| Empty values | Fields not present on an event arrive as empty strings unless "leave out empty fields" is enabled per endpoint. Treat `""` as absent. |
| Time zone | Per endpoint: as-is / true UTC / client wall-clock. Default mix: `starttime`, `answertime`, `timestamp` are Israel local `YYYY-MM-DD HH:MM:SS`; `endtime` is UTC ISO 8601 `…Z`. ISO 8601 with client offset (`2026-10-30T14:05:09+02:00`) is available and is what we request. |
| Test mode | Their side can build the exact request and log it as `TEST MODE - NOT SENT` without sending |
| Template syntax | `{{fieldName}}` (primary) or `{call.field}` / `{client.param}` (alternative) |
| Transforms available on their side | E.164 phone format, per-client lookup table, seconds as `mm:ss`, date only, JSON-string per field, nested keys (`records[0].fields.Caller`) |

## Trigger events

| Event key (ours) | Globalex trigger | When it fires |
| --- | --- | --- |
| `newchannel` | Newchannel | Call starts (channel created) |
| `begin` | Begin | Dial begins toward an extension |
| `ring` | Ring | The dialled side is ringing |
| `ringing` | Ringing | Caller hears ringback |
| `answer` | Answer | Call answered (bridge) |
| `hangup` | Hangup | Call disconnected |
| `cdr` | CDR | Call ended; final record (richest event) |
| `dtmf` | DTMF | Digit pressed in IVR |
| `ivrinput` | IVRInput | Completed input at a Read() prompt |

We enable **Ring, Answer, Hangup, CDR, DTMF**. The `event` field is a fixed
string set per trigger in their template (see "Our payload template").

## Field catalogue

`•` = present on that event. "n/e" = not on every call (only when the scenario
produces it). Aliases are alternative template names for the same value.

**Identity**

| Field | Meaning | Cdr | Ring | Ans | Hang | DTMF |
| --- | --- | --- | --- | --- | --- | --- |
| `call_id` | Same id on every leg of the call. **Our document id.** Alias `uniqueid`, `root_uniqueid` | • | • | • | • | • |
| `channel` | AMI channel name | • | • | • | • | • |
| `destinationchannel` | Channel of answering party (n/e) | • | | | | |
| `uniqueid1` / `uniqueid2` | Uniqueids of the two bridged channels (n/e) | | | • | | |
| `channel1` / `channel2` | The two bridged channels (n/e) | | | • | | |
| `destuniqueid` | Uniqueid of leg being dialled (n/e, Begin only) | | | | | |

**Parties**

| Field | Meaning | Cdr | Ring | Ans | Hang | DTMF |
| --- | --- | --- | --- | --- | --- | --- |
| `caller_number` | Caller phone number. Alias `calleridnum`, `src`, `source` | • | • | • | • | • |
| `calleridname` | Caller name if trunk sends it (n/e) | • | • | • | • | • |
| `callerid1` / `callerid2` | Caller ids of the two bridged channels (n/e) | | | • | | |
| `connectedlinenum` / `connectedlinename` | Connected party number / name (n/e) | | • | • | • | |
| `destination` | Destination (CDR field). Alias `dst`, `dest_number` | • | • | • | • | |
| `destination_number` | Number the call was sent to; may end in `_<domain>` (n/e) | • | • | • | • | • |
| `destination_number_clean` | digits only, no `_<domain>` suffix (n/e) | • | • | • | • | • |
| `destination_number_full` | digits only, leading 0 (n/e) | • | • | • | • | • |
| `destination_number_stripped` | digits only, no leading 0 (n/e) | • | • | • | • | • |
| `extension` | Extension, raw from AMI (n/e). Alias `exten` | • | • | • | • | • |
| `extension_stripped` | extension without leading 0 (n/e) | • | • | • | • | • |
| `answeringExtension` | Extension that actually answered (n/e). Alias `answered_extension`, `answering_extension`. **Not on Ring.** | • | | • | • | |
| `did_number` | DID dialled, inbound (n/e). Alias `did`, `DID_number`. **Our tenant key.** | • | • | • | • | • |
| `did_number_stripped` | DID without leading 0 (n/e) | • | • | • | • | • |
| `callerid` | Displayed caller id, outbound, e.g. `"Company" <0501234567>` | • | | | | |
| `outbound_callerid` | Outbound CID from Hangup/NewCallerid (n/e) | • | | | | |
| `outboundCallerId` | CID shown on the outbound leg (n/e) | | | • | | |

**Direction and result**

| Field | Values | Cdr | Ring | Ans | Hang | DTMF |
| --- | --- | --- | --- | --- | --- | --- |
| `direction` | `inbound` / `outbound` / `internal`. Alias `call_direction` | • | • | • | • | • |
| `call_direction_numeric` | 1 inbound, 2 outbound, 3 internal (n/e) | • | | | | |
| `callType` | `inbound`, `outbound`, `internal`, `inbound-sim`, `outbound-sim`, `inbound-trunk` (Newchannel only) | | | | | |
| `fromout` / `toout` | `1` = from/to outside, empty = internal (n/e) | • | | | | |
| `disposition` | `ANSWERED` / `NO ANSWER` / `BUSY` / `FAILED` | • | | | | |
| `dialstatus` | `ANSWER` / `NOANSWER` / `BUSY` / `CONGESTION` (Begin only, n/e) | | | | | |
| `cause` | Hangup cause, AMI numeric (e.g. 16) | | | | • | |
| `cause_text` / `cause-txt` | Hangup cause in words (`Normal Clearing`) | | | | • | |
| `channelstate` / `channelstatedesc` | Asterisk state numeric / `Ring`, `Ringing`, `Up` | | • | • | | |

**Timing**

| Field | Format | Cdr | Ring | Ans | Hang | DTMF |
| --- | --- | --- | --- | --- | --- | --- |
| `timestamp` | When the event reached their server; filled on every trigger | • | • | • | • | • |
| `starttime` | Call start. Alias `start_time` | • | | | | |
| `starttime_unix` | Unix seconds (n/e) | • | | | | |
| `answertime` | Answer time; empty if not answered. Alias `answer_time` | • | | • | | |
| `endtime` | Call end. Alias `end_time` | • | | | | |
| `duration` | Total seconds | • | | | | |
| `talk_time` | Billable seconds after answer. Alias `billsec`, `billableseconds` | • | | | | |
| `begin` / `end` | Start / end of a digit press | | | | | • |

**Routing**

| Field | Values | Cdr | Ring | Ans | Hang | DTMF |
| --- | --- | --- | --- | --- | --- | --- |
| `scenario` | `Dial` / `Queue` / `RingGroup` / `IVR` (n/e) | • | | | | |
| `applicationType` | `Queue` / `RingGroup` / `IVR` / `Voicemail` (n/e) | • | | | | |
| `applicationNumber` | Application / queue number (n/e) | • | • | • | | |
| `queueName` | Queue name (n/e). Alias `queue`, `Queue` | • | • | • | • | • |
| `ringGroupName` | Ring group name (n/e). Alias `ringgroup`, `RingGroup` | • | • | • | • | |
| `ivrName` / `ivrNumber` | IVR name / number (n/e) | • | | | | |
| `voicemailBox` | Voicemail box (n/e) | • | | | | |
| `announcementName` | Auto-announcement name (n/e) | • | | | • | |
| `context` / `dcontext` / `destinationcontext` | Asterisk contexts | • | • | • | • | • |
| `lastapp` / `lastapplication` / `lastdata` | Last Asterisk app and its args (`Dial`, `SIP/201…,300,`) | • | | | | |
| `dialstring` | What Asterisk dialled (n/e) | | • | | | |
| `bridgestate` / `bridgetype` | `Link`/`Unlink`, bridge type (n/e) | | | • | | |
| `transfertype` | `Blind` / attended (n/e) | | | | | • |
| `subevent` | `Begin` / `End` (Begin only) | | | | | |
| `amaflags` / `accountcode` | Asterisk billing flag / account code | • | | | • | |

**IVR / DTMF input**

| Field | Meaning | Cdr | Ring | Ans | Hang | DTMF |
| --- | --- | --- | --- | --- | --- | --- |
| `digit` | Pressed digit; on CDR = latest accumulated main-IVR selection | • | | | | • |
| `dtmf_application` / `dtmf_context` / `dtmf_scope` | App / context / purpose when digit received (n/e) | | | | | • |
| `ivr_input_1..3`, `ivr_input_N_name` | Nth collected input and its name (n/e) | • | | | • | |
| `ivr_input_count` / `ivr_input_last` / `ivr_input_last_name` | Count / most recent input / its name (n/e) | • | | | • | |
| `ivr_inputs_json` | All inputs as JSON, e.g. `{"compNum":"3500","empNum":"43434547"}` (n/e) | • | | | • | |
| `ivr_inputs_text` | `compNum=3500;empNum=43434547` (n/e) | • | | | • | |
| `ivr_input_name` / `ivr_input_value` | Read() variable and value (IVRInput only) | | | | | |
| `input_<name>` | Dynamic per collected input, e.g. `input_compNum` (n/e) | • | | | • | |

**Callback, recording, webcall, tenant**

| Field | Meaning | Cdr | Ring | Ans | Hang | DTMF |
| --- | --- | --- | --- | --- | --- | --- |
| `callback_requested` / `callback_caller_number` / `callback_number` / `callback_queue` | Callback-request flow (n/e). Alias `callback_requested_number` | • | | | | |
| `recording_available` | `true` / `false` (n/e) | • | | | | |
| `recording_filename` | e.g. `IN201-20251119-085234-1763328773.117048.wav` (n/e) | • | | | | |
| `recording_play_url` | Stream URL `https://voip1.globalex.co.il/API/play.php?fileid=…` (n/e). Alias `recording_url` | • | | | | |
| `recording_download_url` | `https://voip1.globalex.co.il/API/download-file.php?fileid=…` (n/e) | • | | | | |
| `userfield` | Raw recording path (n/e) | • | | | | |
| `call_origin` | `webcall` / `callback` / `direct` (n/e) | • | | | • | |
| `is_webcall` / `webcall_user` | WebCall flag / username (n/e) | • | | | • | |
| `call_leg_type` | `sip` / `local_1` / `local_2` (n/e) | • | | | • | |
| `client_id` | Numeric client id | • | • | • | • | • |
| `org_name` | Organisation domain. Alias `organization`, `domain` | • | • | • | • | • |
| `server_address` / `server_id` | Hostname / 1–12. Alias `ServerAddress`, `serverId` | • | • | • | • | • |
| `trunk_name` | Trunk used (n/e) | | • | • | • | • |
| `ipaddr` | IP the call came from (n/e) | • | | | | |

## Known gaps (confirmed with Globalex before relying on them)

- Voicemail audio: `applicationType = Voicemail` / `voicemailBox` flag the call, but the docs do not say whether the message file is the `recording_download_url` or a separate file.
- Recording links: not stated whether `play.php` / `download-file.php` need a login or how long they stay valid.
- `answeringExtension` is **not** on Ring; for queue / ring-group calls the agent is known only at Answer.

## Our payload template (what we give Globalex)

One endpoint, five triggers, same shape on all; `event` is a fixed literal per trigger.

```json
{
  "event": "ring | answer | hangup | cdr | dtmf",
  "call_id": "{{call_id}}",
  "timestamp": "{{timestamp}}",
  "direction": "{{direction}}",
  "caller_number": "{{caller_number}}",
  "caller_name": "{{calleridname}}",
  "did_number": "{{did_number}}",
  "destination_number": "{{destination_number_clean}}",
  "extension": "{{extension}}",
  "answering_extension": "{{answeringExtension}}",
  "queue": "{{queueName}}",
  "ring_group": "{{ringGroupName}}",
  "ivr_name": "{{ivrName}}",
  "digit": "{{digit}}",
  "ivr_inputs": "{{ivr_inputs_json}}",
  "starttime": "{{starttime}}",
  "answertime": "{{answertime}}",
  "endtime": "{{endtime}}",
  "duration": "{{duration}}",
  "talk_time": "{{talk_time}}",
  "disposition": "{{disposition}}",
  "cause_text": "{{cause_text}}",
  "application_type": "{{applicationType}}",
  "voicemail_box": "{{voicemailBox}}",
  "lastapp": "{{lastapp}}",
  "recording_available": "{{recording_available}}",
  "recording_play_url": "{{recording_play_url}}",
  "recording_download_url": "{{recording_download_url}}",
  "recording_filename": "{{recording_filename}}",
  "org_name": "{{org_name}}",
  "client_id": "{{client_id}}",
  "server_id": "{{server_id}}"
}
```

Settings requested on their side: header `X-API-Key` with a per-client value;
retry on; ISO 8601 with client offset for all time fields; leave out empty
fields on.

## What each event must do in our system

| event | Required fields | Effect |
| --- | --- | --- |
| `ring` | call_id, direction, caller_number, did_number | Upsert call (status `ringing`), resolve company by DID, find/create customer, find/create open ticket, write `ringing/{call_id}` (pop-up) |
| `answer` | call_id | status `answered`, answertime, answering_extension; delete `ringing/{call_id}` |
| `hangup` | call_id | if never answered → status `missed` + `missed_call` event; delete `ringing/{call_id}` |
| `cdr` | call_id, disposition | finalise: duration, talk_time, times, ivr_inputs, recording_*, voicemail detection (`application_type == Voicemail` or `voicemail_box` or `lastapp == VoiceMail`), timeline event; outbound → end-of-call prompt (no auto ticket) |
| `dtmf` | call_id, digit | append to call's IVR trail |

Rules: writes are merges on `calls/{call_id}`; an event with `timestamp`
older than the stored status is ignored; unknown DID → log at `warn` and
drop, never auto-create a company; respond 200 within 1 s, then process.

**Inbound field mapping.** Globalex is the provider; we parse whatever their
webhook sends. The schema accepts each field's native name and the aliases
listed in the Field catalogue above (e.g. `uniqueid`/`root_uniqueid` →
`call_id`, `calleridnum`/`src`/`source` → `caller_number`, `did`/`DID_number`
→ `did_number`, `billsec` → `talk_time`), mapping them onto the canonical keys
before validation, so no bespoke per-field template is required on their side.
The `event` discriminator is still set per trigger (ring/answer/hangup/cdr/dtmf)
as Globalex's own webhook builder defines.
