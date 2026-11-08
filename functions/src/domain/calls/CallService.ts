import { assertNever } from '../../shared/assertNever.js';
import { parseGlobalexTime } from '../../shared/time.js';
import { COMPANY_DEFAULTS } from '../../shared/defaults.js';
import type { GlobalexPayload, GlobalexEvent } from '../../shared/schemas/globalexPayload.js';
import type { Clock } from '../ports/Clock.js';
import type { IdGen } from '../ports/IdGen.js';
import type { CompanyRepo } from '../ports/CompanyRepo.js';
import type { CallRepo } from '../ports/CallRepo.js';
import type { EventRepo } from '../ports/EventRepo.js';
import type { RingingRepo } from '../ports/RingingRepo.js';
import type { Company } from '../companies/types.js';
import type { Customer } from '../customers/types.js';
import type { CustomerService } from '../customers/CustomerService.js';
import type { TicketService } from '../tickets/TicketService.js';
import type { PhoneNormalizer } from '../customers/PhoneNormalizer.js';
import { CallStateMachine } from './CallStateMachine.js';
import type { Call, CallDirection, CallStatus } from './types.js';

/** What the handler decided, for the single `info`/`warn` line at the root. */
export interface HandleOutcome {
  readonly event: GlobalexEvent;
  readonly callId: string;
  readonly result: 'applied' | 'ignored';
  readonly reason?: string;
  readonly companyId?: string;
  readonly customerId?: string;
  readonly customer?: 'created' | 'matched';
  readonly ticket?: 'created' | 'resumed' | 'none';
  readonly status?: CallStatus;
}

/**
 * The single service the webhook handler calls. It runs the same pipeline on
 * every event and differs only in what it writes. All matching rules and what
 * each event must do are in docs/globalex-webhook.md; do not invent behaviour
 * this service's inputs do not support.
 *
 * It coordinates several sub-services (customers, tickets) and repos; that is
 * the one place where more than ~5 collaborators is expected (CLAUDE.md §1.5).
 */
export class CallService {
  private readonly stateMachine = new CallStateMachine();

  constructor(
    private readonly companies: CompanyRepo,
    private readonly customers: CustomerService,
    private readonly tickets: TicketService,
    private readonly calls: CallRepo,
    private readonly events: EventRepo,
    private readonly ringing: RingingRepo,
    private readonly clock: Clock,
    private readonly ids: IdGen,
    private readonly phones: PhoneNormalizer,
  ) {}

  handle(payload: GlobalexPayload): Promise<HandleOutcome> {
    switch (payload.event) {
      case 'ring':
        return this.handleRing(payload);
      case 'answer':
        return this.handleAnswer(payload);
      case 'hangup':
        return this.handleHangup(payload);
      case 'cdr':
        return this.handleCdr(payload);
      case 'dtmf':
        return this.handleDtmf(payload);
      default:
        return assertNever(payload.event);
    }
  }

  // ---- ring: create/resume everything and fire the pop-up --------------------

  private async handleRing(p: GlobalexPayload): Promise<HandleOutcome> {
    const did = p.did_number ? this.phones.normalize(p.did_number) : null;
    if (did === null) return this.ignored(p, 'missing_or_unparseable_did');

    const caller = p.caller_number ? this.phones.normalize(p.caller_number) : null;
    if (caller === null) return this.ignored(p, 'missing_or_unparseable_caller');

    const company = await this.companies.resolveByDid(did);
    if (company === null) return this.ignored(p, 'unknown_did');

    const existing = await this.calls.get(p.call_id);
    const now = this.eventTime(p);
    if (existing && this.isStale(now, existing)) {
      return { event: 'ring', callId: p.call_id, result: 'ignored', reason: 'out_of_order', companyId: company.id };
    }

    const { customer, created } = await this.customers.findOrCreateByPhone({
      companyId: company.id,
      phoneE164: caller,
      ...(p.caller_name !== undefined ? { name: p.caller_name } : {}),
    });

    const { ticket, resumed } = await this.tickets.openOrResume({
      companyId: company.id,
      customerId: customer.id,
      openedBy: 'call',
    });

    const transition = this.stateMachine.transition(existing?.status, 'ring');
    const status: CallStatus = transition.applied ? transition.status : (existing?.status ?? 'ringing');

    const call: Call = {
      id: p.call_id,
      companyId: company.id,
      customerId: customer.id,
      direction: this.directionOf(p, existing),
      status,
      lastEventAt: now,
      startTime: existing?.startTime ?? now,
      ticketId: ticket.id,
      didNumber: did,
      callerNumber: caller,
      ...(existing?.answerTime !== undefined ? { answerTime: existing.answerTime } : {}),
    };
    await this.calls.upsert(call);

    await this.ringing.set({
      id: p.call_id,
      companyId: company.id,
      customerId: customer.id,
      startedAt: now,
      expiresAt: new Date(now.getTime() + COMPANY_DEFAULTS.ringingTtlSeconds * 1000),
      callerNumber: caller,
      didNumber: did,
      ...(p.extension !== undefined ? { extension: p.extension } : {}),
    });

    return {
      event: 'ring',
      callId: p.call_id,
      result: 'applied',
      companyId: company.id,
      customerId: customer.id,
      customer: created ? 'created' : 'matched',
      ticket: resumed ? 'resumed' : 'created',
      status,
    };
  }

  // ---- answer: mark answered, close the pop-up -------------------------------

  private async handleAnswer(p: GlobalexPayload): Promise<HandleOutcome> {
    const existing = await this.calls.get(p.call_id);
    if (existing === null) return this.ignored(p, 'call_not_found');

    const now = this.eventTime(p);
    if (this.isStale(now, existing)) return this.ignoredFor(p, existing, 'out_of_order');

    const transition = this.stateMachine.transition(existing.status, 'answer');
    if (!transition.applied) return this.ignoredFor(p, existing, transition.reason);

    const answerTime = p.answertime ? parseGlobalexTime(p.answertime) ?? now : now;
    const call: Call = {
      ...existing,
      status: transition.status,
      lastEventAt: now,
      answerTime,
      ...(p.answering_extension !== undefined ? { answeringExtension: p.answering_extension } : {}),
    };
    await this.calls.upsert(call);
    await this.ringing.delete(p.call_id);

    return this.appliedFor('answer', existing, transition.status);
  }

  // ---- hangup: missed if never answered, close the pop-up --------------------

  private async handleHangup(p: GlobalexPayload): Promise<HandleOutcome> {
    const existing = await this.calls.get(p.call_id);
    if (existing === null) return this.ignored(p, 'call_not_found');

    const now = this.eventTime(p);
    if (this.isStale(now, existing)) return this.ignoredFor(p, existing, 'out_of_order');

    const transition = this.stateMachine.transition(existing.status, 'hangup');
    if (!transition.applied) return this.ignoredFor(p, existing, transition.reason);

    const call: Call = { ...existing, status: transition.status, lastEventAt: now };
    await this.calls.upsert(call);
    await this.ringing.delete(p.call_id);

    if (transition.status === 'missed') {
      await this.events.append({
        id: this.ids.next(),
        companyId: existing.companyId,
        customerId: existing.customerId,
        type: 'missed_call',
        summary: 'Missed call',
        payload: { callId: existing.id, callerNumber: existing.callerNumber ?? null },
        at: now,
        source: 'globalex',
        ...(existing.ticketId !== undefined ? { ticketId: existing.ticketId } : {}),
      });
    }

    return this.appliedFor('hangup', existing, transition.status);
  }

  // ---- cdr: finalise, detect voicemail, write the timeline event -------------

  private async handleCdr(p: GlobalexPayload): Promise<HandleOutcome> {
    const existing = await this.calls.get(p.call_id);
    const now = this.eventTime(p);
    if (existing && this.isStale(now, existing)) return this.ignoredFor(p, existing, 'out_of_order');

    // Resolve tenant/customer: reuse the call if we have one, else bootstrap.
    let companyId: string;
    let customerId: string;
    let ticketId: string | undefined;
    let callerNumber: string | undefined;
    let didNumber: string | undefined;
    let created = false;
    const direction = this.directionOf(p, existing);

    if (existing) {
      companyId = existing.companyId;
      customerId = existing.customerId;
      ticketId = existing.ticketId;
      callerNumber = existing.callerNumber;
      didNumber = existing.didNumber;
    } else {
      const did = p.did_number ? this.phones.normalize(p.did_number) : null;
      const caller = p.caller_number ? this.phones.normalize(p.caller_number) : null;
      if (did === null || caller === null) return this.ignored(p, 'cdr_missing_identity');
      const company: Company | null = await this.companies.resolveByDid(did);
      if (company === null) return this.ignored(p, 'unknown_did');
      const customer = await this.bootstrapCustomer(company, p, caller);
      companyId = company.id;
      customerId = customer.customer.id;
      callerNumber = caller;
      didNumber = did;
      created = customer.created;
      // Inbound opens/resumes a ticket; outbound never auto-opens one.
      if (direction !== 'outbound') {
        const t = await this.tickets.openOrResume({ companyId, customerId, openedBy: 'call' });
        ticketId = t.ticket.id;
      }
    }

    const voicemail = this.isVoicemail(p);
    const status: CallStatus = voicemail ? 'voicemail' : this.statusFromDisposition(p.disposition, existing?.status);

    const call: Call = {
      id: p.call_id,
      companyId,
      customerId,
      direction,
      status,
      lastEventAt: now,
      startTime: this.timeField(p.starttime) ?? existing?.startTime ?? now,
      ...(this.timeField(p.endtime) !== null ? { endTime: this.timeField(p.endtime) as Date } : {}),
      ...(this.timeField(p.answertime) !== null ? { answerTime: this.timeField(p.answertime) as Date } : existing?.answerTime !== undefined ? { answerTime: existing.answerTime } : {}),
      ...(this.intField(p.duration) !== null ? { duration: this.intField(p.duration) as number } : {}),
      ...(this.intField(p.talk_time) !== null ? { talkTime: this.intField(p.talk_time) as number } : {}),
      ...(this.ivrInputs(p) !== null ? { ivrInputs: this.ivrInputs(p) as Record<string, string> } : existing?.ivrInputs !== undefined ? { ivrInputs: existing.ivrInputs } : {}),
      ...(p.recording_play_url !== undefined ? { recordingUrl: p.recording_play_url } : existing?.recordingUrl !== undefined ? { recordingUrl: existing.recordingUrl } : {}),
      ...(ticketId !== undefined ? { ticketId } : {}),
      ...(callerNumber !== undefined ? { callerNumber } : {}),
      ...(didNumber !== undefined ? { didNumber } : {}),
      ...(existing?.answeringExtension !== undefined ? { answeringExtension: existing.answeringExtension } : p.answering_extension !== undefined ? { answeringExtension: p.answering_extension } : {}),
    };
    await this.calls.upsert(call);

    await this.events.append({
      id: this.ids.next(),
      companyId,
      customerId,
      type: voicemail ? 'voicemail' : status === 'missed' ? 'missed_call' : 'call',
      summary: this.cdrSummary(direction, status),
      payload: {
        callId: p.call_id,
        direction,
        disposition: p.disposition ?? null,
        durationSeconds: this.intField(p.duration),
        recordingAvailable: p.recording_available === 'true',
      },
      at: now,
      source: 'globalex',
      ...(ticketId !== undefined ? { ticketId } : {}),
    });

    return {
      event: 'cdr',
      callId: p.call_id,
      result: 'applied',
      companyId,
      customerId,
      customer: existing ? 'matched' : created ? 'created' : 'matched',
      ticket: ticketId !== undefined ? 'resumed' : 'none',
      status,
    };
  }

  // ---- dtmf: append the digit to the IVR trail -------------------------------

  private async handleDtmf(p: GlobalexPayload): Promise<HandleOutcome> {
    const existing = await this.calls.get(p.call_id);
    if (existing === null) return this.ignored(p, 'call_not_found');
    if (p.digit === undefined) return this.ignoredFor(p, existing, 'missing_digit');

    const now = this.eventTime(p);
    const trail = (existing.ivrInputs?.dtmf ?? '') + p.digit;
    const call: Call = {
      ...existing,
      lastEventAt: now,
      ivrInputs: { ...existing.ivrInputs, dtmf: trail },
    };
    await this.calls.upsert(call);

    return this.appliedFor('dtmf', existing, existing.status);
  }

  // ---- helpers ---------------------------------------------------------------

  private async bootstrapCustomer(
    company: Company,
    p: GlobalexPayload,
    caller: string,
  ): Promise<{ customer: Customer; created: boolean }> {
    return this.customers.findOrCreateByPhone({
      companyId: company.id,
      phoneE164: caller,
      ...(p.caller_name !== undefined ? { name: p.caller_name } : {}),
    });
  }

  private directionOf(p: GlobalexPayload, existing: Call | null): CallDirection {
    return p.direction ?? existing?.direction ?? 'inbound';
  }

  private eventTime(p: GlobalexPayload): Date {
    return (p.timestamp ? parseGlobalexTime(p.timestamp) : null) ?? this.clock.now();
  }

  private isStale(eventTime: Date, existing: Call): boolean {
    return eventTime.getTime() < existing.lastEventAt.getTime();
  }

  private timeField(raw: string | undefined): Date | null {
    return raw ? parseGlobalexTime(raw) : null;
  }

  private intField(raw: string | undefined): number | null {
    if (raw === undefined) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? Math.trunc(n) : null;
  }

  private isVoicemail(p: GlobalexPayload): boolean {
    return (
      p.application_type?.toLowerCase() === 'voicemail' ||
      p.voicemail_box !== undefined ||
      p.lastapp?.toLowerCase() === 'voicemail'
    );
  }

  private statusFromDisposition(
    disposition: GlobalexPayload['disposition'],
    fallback: CallStatus | undefined,
  ): CallStatus {
    if (disposition === undefined) return fallback ?? 'missed';
    switch (disposition) {
      case 'ANSWERED':
        return 'answered';
      case 'NO ANSWER':
      case 'BUSY':
      case 'FAILED':
        return 'missed';
      default:
        return assertNever(disposition);
    }
  }

  private ivrInputs(p: GlobalexPayload): Record<string, string> | null {
    if (p.ivr_inputs === undefined) return null;
    try {
      const parsed: unknown = JSON.parse(p.ivr_inputs);
      if (parsed === null || typeof parsed !== 'object') return null;
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
        out[k] = typeof v === 'string' ? v : String(v);
      }
      return out;
    } catch {
      // Malformed IVR JSON is a provider quirk, not a failure; drop it.
      return null;
    }
  }

  private cdrSummary(direction: CallDirection, status: CallStatus): string {
    return `${direction} call (${status})`;
  }

  private ignored(p: GlobalexPayload, reason: string): HandleOutcome {
    return { event: p.event, callId: p.call_id, result: 'ignored', reason };
  }

  private ignoredFor(p: GlobalexPayload, existing: Call, reason: string): HandleOutcome {
    return {
      event: p.event,
      callId: p.call_id,
      result: 'ignored',
      reason,
      companyId: existing.companyId,
      customerId: existing.customerId,
    };
  }

  private appliedFor(event: GlobalexEvent, existing: Call, status: CallStatus): HandleOutcome {
    return {
      event,
      callId: existing.id,
      result: 'applied',
      companyId: existing.companyId,
      customerId: existing.customerId,
      status,
    };
  }
}
