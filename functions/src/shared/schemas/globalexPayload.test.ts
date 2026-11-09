import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { GlobalexPayloadSchema, GLOBALEX_EVENTS } from './globalexPayload.js';

function fixture(name: string): unknown {
  const url = new URL(`../../test/fixtures/globalex/${name}.json`, import.meta.url);
  return JSON.parse(readFileSync(fileURLToPath(url), 'utf8'));
}

describe('GlobalexPayloadSchema', () => {
  it.each([...GLOBALEX_EVENTS])('parses the %s fixture', (event) => {
    const parsed = GlobalexPayloadSchema.parse(fixture(event));
    expect(parsed.event).toBe(event);
    expect(parsed.call_id).toBe('1763328773.117048');
  });

  it('coerces empty strings to undefined (CDR fixture)', () => {
    const parsed = GlobalexPayloadSchema.parse(fixture('cdr'));
    expect(parsed.application_type).toBeUndefined();
    expect(parsed.voicemail_box).toBeUndefined();
    expect(parsed.digit).toBeUndefined();
    // Non-empty fields survive.
    expect(parsed.disposition).toBe('ANSWERED');
    expect(parsed.recording_play_url).toContain('play.php');
  });

  it('strips unknown keys', () => {
    const parsed = GlobalexPayloadSchema.parse({
      event: 'ring',
      call_id: 'x',
      caller_number: '0521234567',
      did_number: '037654321',
      some_future_field: 'ignore me',
    });
    expect('some_future_field' in parsed).toBe(false);
  });

  it('rejects an unknown event and a missing call_id', () => {
    expect(GlobalexPayloadSchema.safeParse({ event: 'bogus', call_id: 'x' }).success).toBe(false);
    expect(GlobalexPayloadSchema.safeParse({ event: 'ring', call_id: '' }).success).toBe(false);
  });

  it("accepts Globalex's native field names (aliases)", () => {
    const parsed = GlobalexPayloadSchema.parse({
      event: 'ring',
      uniqueid: '1763328773.1',
      calleridnum: '0521234567',
      calleridname: 'Dana',
      did: '037654321',
      answeringExtension: '201',
      queueName: 'support',
      billsec: '42',
      applicationType: 'Queue',
    });
    expect(parsed.call_id).toBe('1763328773.1');
    expect(parsed.caller_number).toBe('0521234567');
    expect(parsed.caller_name).toBe('Dana');
    expect(parsed.did_number).toBe('037654321');
    expect(parsed.answering_extension).toBe('201');
    expect(parsed.queue).toBe('support');
    expect(parsed.talk_time).toBe('42');
    expect(parsed.application_type).toBe('Queue');
  });

  it('prefers the canonical key when both canonical and alias are present', () => {
    const parsed = GlobalexPayloadSchema.parse({
      event: 'cdr',
      call_id: 'canonical',
      uniqueid: 'alias',
      disposition: 'ANSWERED',
    });
    expect(parsed.call_id).toBe('canonical');
  });
});
