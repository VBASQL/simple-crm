import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

import { CallService } from './CallService.js';
import { CustomerService } from '../customers/CustomerService.js';
import { TicketService } from '../tickets/TicketService.js';
import { TicketPolicy } from '../tickets/TicketPolicy.js';
import { PhoneNormalizer } from '../customers/PhoneNormalizer.js';
import { GlobalexPayloadSchema } from '../../shared/schemas/globalexPayload.js';
import type { Company } from '../companies/types.js';
import {
  FixedClock,
  SeqIdGen,
  InMemoryCompanyRepo,
  InMemoryCustomerRepo,
  InMemoryCallRepo,
  InMemoryTicketRepo,
  InMemoryEventRepo,
  InMemoryRingingRepo,
} from '../../test/fakes/index.js';

const CALL_ID = '1763328773.117048';
const DID_E164 = '+97237654321';
const CALLER_E164 = '+972521234567';

const COMPANY: Company = {
  id: 'co-1',
  name: 'Acme',
  timezone: 'Asia/Jerusalem',
  language: 'he',
  ticketAutoCloseDays: 14,
  retentionMonths: 12,
};

function fixture(name: string): Record<string, unknown> {
  const url = new URL(`../../test/fixtures/globalex/${name}.json`, import.meta.url);
  return JSON.parse(readFileSync(fileURLToPath(url), 'utf8')) as Record<string, unknown>;
}

function payload(name: string, overrides: Record<string, unknown> = {}) {
  return GlobalexPayloadSchema.parse({ ...fixture(name), ...overrides });
}

function makeSut() {
  const clock = new FixedClock(new Date('2026-10-30T10:00:00Z'));
  const ids = new SeqIdGen();
  const companies = new InMemoryCompanyRepo().seedCompany(COMPANY).seedDid(DID_E164, COMPANY.id);
  const customers = new InMemoryCustomerRepo();
  const calls = new InMemoryCallRepo();
  const tickets = new InMemoryTicketRepo();
  const events = new InMemoryEventRepo();
  const ringing = new InMemoryRingingRepo();

  const customerService = new CustomerService(customers, clock, ids);
  const ticketService = new TicketService(tickets, clock, ids, new TicketPolicy(14));
  const svc = new CallService(
    companies,
    customerService,
    ticketService,
    calls,
    events,
    ringing,
    clock,
    ids,
    new PhoneNormalizer(),
  );
  return { svc, customers, calls, tickets, events, ringing };
}

describe('CallService.handle', () => {
  it('ring creates customer, ticket, call and ringing pop-up', async () => {
    const { svc, customers, tickets, calls, ringing } = makeSut();
    const out = await svc.handle(payload('ring'));

    expect(out).toMatchObject({ result: 'applied', customer: 'created', ticket: 'created', status: 'ringing' });
    expect(customers.createCount).toBe(1);
    expect(tickets.createCount).toBe(1);
    const call = calls.byId.get(CALL_ID);
    expect(call?.status).toBe('ringing');
    expect(call?.callerNumber).toBe(CALLER_E164);
    expect(call?.didNumber).toBe(DID_E164);
    expect(ringing.byId.has(CALL_ID)).toBe(true);
  });

  it('a second ring is idempotent — no duplicate customer or ticket', async () => {
    const { svc, customers, tickets } = makeSut();
    await svc.handle(payload('ring'));
    const out = await svc.handle(payload('ring'));

    expect(out).toMatchObject({ customer: 'matched', ticket: 'resumed' });
    expect(customers.createCount).toBe(1);
    expect(tickets.createCount).toBe(1);
  });

  it('drops a ring on an unknown DID without creating anything', async () => {
    const { svc, customers, calls, ringing } = makeSut();
    const out = await svc.handle(payload('ring', { did_number: '039999999' }));

    expect(out).toMatchObject({ result: 'ignored', reason: 'unknown_did' });
    expect(customers.createCount).toBe(0);
    expect(calls.byId.size).toBe(0);
    expect(ringing.byId.size).toBe(0);
  });

  it('answer marks answered and clears the pop-up', async () => {
    const { svc, calls, ringing } = makeSut();
    await svc.handle(payload('ring'));
    const out = await svc.handle(payload('answer'));

    expect(out.status).toBe('answered');
    const call = calls.byId.get(CALL_ID);
    expect(call?.status).toBe('answered');
    expect(call?.answeringExtension).toBe('201');
    expect(call?.answerTime).toBeInstanceOf(Date);
    expect(ringing.byId.size).toBe(0);
  });

  it('hangup with no prior answer → missed + a missed_call timeline event', async () => {
    const { svc, calls, events, ringing } = makeSut();
    await svc.handle(payload('ring'));
    const out = await svc.handle(payload('hangup'));

    expect(out.status).toBe('missed');
    expect(calls.byId.get(CALL_ID)?.status).toBe('missed');
    expect(events.events.some((e) => e.type === 'missed_call')).toBe(true);
    expect(ringing.byId.size).toBe(0);
  });

  it('cdr finalises an answered call with duration, recording and IVR inputs', async () => {
    const { svc, calls, events } = makeSut();
    await svc.handle(payload('ring'));
    await svc.handle(payload('answer'));
    const out = await svc.handle(payload('cdr'));

    expect(out.status).toBe('answered');
    const call = calls.byId.get(CALL_ID);
    expect(call?.duration).toBe(53);
    expect(call?.talkTime).toBe(49);
    expect(call?.recordingUrl).toContain('play.php');
    expect(call?.ivrInputs?.compNum).toBe('3500');
    expect(events.events.some((e) => e.type === 'call')).toBe(true);
  });

  it('cdr with applicationType Voicemail → voicemail status and event', async () => {
    const { svc, calls, events } = makeSut();
    await svc.handle(payload('ring'));
    const out = await svc.handle(payload('cdr', { application_type: 'Voicemail', disposition: 'NO ANSWER' }));

    expect(out.status).toBe('voicemail');
    expect(calls.byId.get(CALL_ID)?.status).toBe('voicemail');
    expect(events.events.some((e) => e.type === 'voicemail')).toBe(true);
  });

  it('ignores an event whose timestamp predates the stored state', async () => {
    const { svc } = makeSut();
    await svc.handle(payload('ring')); // 14:05:09+02:00
    const out = await svc.handle(payload('answer', { timestamp: '2026-10-30T14:05:00+02:00' }));

    expect(out).toMatchObject({ result: 'ignored', reason: 'out_of_order' });
  });

  it('dtmf appends to the call IVR trail', async () => {
    const { svc, calls } = makeSut();
    await svc.handle(payload('ring'));
    await svc.handle(payload('dtmf'));

    expect(calls.byId.get(CALL_ID)?.ivrInputs?.dtmf).toBe('3');
  });

  it.each(['outbound', 'internal'])('does not route a %s ring (no customer, no ticket, no call)', async (direction) => {
    const { svc, customers, calls, tickets, ringing } = makeSut();
    const out = await svc.handle(payload('ring', { direction }));

    expect(out).toMatchObject({ result: 'ignored', reason: `${direction}_not_routed` });
    expect(customers.createCount).toBe(0);
    expect(tickets.createCount).toBe(0);
    expect(calls.byId.size).toBe(0);
    expect(ringing.byId.size).toBe(0);
  });

  it('routes an anonymous (withheld) inbound caller to the company "Unknown caller" bucket', async () => {
    const { svc, customers, calls, ringing } = makeSut();
    const out = await svc.handle(payload('ring', { caller_number: '' }));

    expect(out).toMatchObject({ result: 'applied', customer: 'created', ticket: 'created' });
    expect(customers.byId.has('anon-co-1')).toBe(true);
    const call = calls.byId.get(CALL_ID);
    expect(call?.customerId).toBe('anon-co-1');
    expect(call?.callerNumber).toBeUndefined();
    expect(ringing.byId.get(CALL_ID)?.callerNumber).toBeUndefined();
  });

  it('reuses the single anonymous bucket across calls', async () => {
    const { svc, customers } = makeSut();
    await svc.handle(payload('ring', { caller_number: '', call_id: 'anon-a' }));
    await svc.handle(payload('ring', { caller_number: '', call_id: 'anon-b' }));

    expect(customers.createCount).toBe(1);
  });

  it('routes an outbound cdr by the outbound line, customer = dialled number, no ticket', async () => {
    const { svc, calls, tickets, customers } = makeSut();
    const out = await svc.handle(
      payload('cdr', {
        direction: 'outbound',
        outbound_callerid: '037654321', // the company DID we called out on → co-1
        destination_number: '0528889999', // the external party we dialled
        disposition: 'ANSWERED',
      }),
    );

    expect(out).toMatchObject({ result: 'applied', companyId: 'co-1', ticket: 'none' });
    const call = calls.byId.get(CALL_ID);
    expect(call?.direction).toBe('outbound');
    expect(call?.didNumber).toBe(DID_E164);
    expect(call?.callerNumber).toBe('+972528889999');
    expect(call?.ticketId).toBeUndefined();
    expect(tickets.createCount).toBe(0);
    expect(customers.byId.get(call?.customerId ?? '')?.phones).toContain('+972528889999');
  });

  it('parses the outbound line out of callerid when outbound_callerid is absent', async () => {
    const { svc } = makeSut();
    const out = await svc.handle(
      payload('cdr', {
        direction: 'outbound',
        callerid: '"Acme" <037654321>',
        destination_number: '0528889999',
        disposition: 'ANSWERED',
      }),
    );
    expect(out).toMatchObject({ result: 'applied', companyId: 'co-1' });
  });

  it('drops an outbound cdr whose line is not a known DID', async () => {
    const { svc } = makeSut();
    const out = await svc.handle(
      payload('cdr', { direction: 'outbound', outbound_callerid: '039999999', destination_number: '0528889999' }),
    );
    expect(out).toMatchObject({ result: 'ignored', reason: 'unknown_did' });
  });
});
