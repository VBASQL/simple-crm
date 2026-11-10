import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider.js';
import { useServices } from '../services/ServicesContext.js';
import { useI18n } from '../i18n/i18n.js';
import { useLinkTo, useBackTarget } from '../nav.js';
import { relativeTime, formatDateTime } from '../format.js';
import { Avatar } from '../components/Avatar.js';
import { Icon } from '../components/Icon.js';
import { PinButton } from '../components/PinButton.js';
import { NoteComposer } from '../components/NoteComposer.js';
import { NotesList } from '../components/NotesList.js';
import { InteractionLogger } from '../components/InteractionLogger.js';
import { MoveTo } from '../components/MoveEvent.js';
import type { Call, Customer, Note, Ticket, TicketStatus, TimelineEvent } from '../types.js';

const STATUSES: TicketStatus[] = ['open', 'pending', 'closed'];
const callIdOf = (e: TimelineEvent): string | undefined => (e.payload as { callId?: string } | undefined)?.callId;

export function TicketDetail() {
  const { ticketId = '' } = useParams();
  const { profile } = useAuth();
  const services = useServices();
  const { t, locale } = useI18n();
  const linkTo = useLinkTo();
  const backTo = useBackTarget('/tickets');

  const [ticket, setTicket] = useState<Ticket | null | undefined>(undefined);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [calls, setCalls] = useState<Call[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [allTickets, setAllTickets] = useState<Ticket[]>([]);

  const [editingSubject, setEditingSubject] = useState(false);
  const [subjectDraft, setSubjectDraft] = useState('');
  const [noteFor, setNoteFor] = useState<string | null>(null); // eventId whose note box is open
  const [error, setError] = useState<string | null>(null);

  const companyId = profile?.companyId;

  useEffect(() => services.subscribeTicket(ticketId, setTicket), [services, ticketId]);

  useEffect(() => {
    if (companyId === undefined) return;
    const unsubs = [
      services.subscribeTicketEvents(companyId, ticketId, setEvents),
      services.subscribeTicketCalls(companyId, ticketId, setCalls),
    ];
    return () => unsubs.forEach((u) => u());
  }, [services, companyId, ticketId]);

  const customerId = ticket?.customerId;
  useEffect(() => {
    if (customerId === undefined) return;
    void services.getCustomer(customerId).then(setCustomer);
  }, [services, customerId]);

  useEffect(() => {
    if (companyId === undefined || customerId === undefined) return;
    const unsubs = [
      services.subscribeNotes(companyId, customerId, setNotes),
      services.subscribeCustomerTickets(companyId, customerId, setAllTickets),
    ];
    return () => unsubs.forEach((u) => u());
  }, [services, companyId, customerId]);

  // The timeline is the ticket's real calls (from the calls collection — so a
  // call that just created this ticket shows at once, before any CDR event)
  // plus manual interactions (email/meeting, a call on another phone). The
  // engine's own call/voicemail/missed_call events carry a payload.callId and
  // are left out, since the call they describe is already shown from the calls
  // collection — no duplicates. Computed before any early return (hook order).
  const timeline = useMemo(() => {
    const callItems = calls.map((c) => ({ key: `c-${c.id}`, at: c.startTime, call: c, event: undefined as TimelineEvent | undefined }));
    const eventItems = events
      .filter((e) => callIdOf(e) === undefined)
      .map((e) => ({ key: `e-${e.id}`, at: e.at, call: undefined as Call | undefined, event: e }));
    return [...callItems, ...eventItems].sort((a, b) => (b.at?.getTime() ?? 0) - (a.at?.getTime() ?? 0));
  }, [calls, events]);

  if (ticket === undefined) return <p className="muted">{t('common.loading')}</p>;
  if (ticket === null)
    return (
      <section>
        <Link to={backTo} className="btn btn--ghost btn--sm">
          <Icon name="back" size={16} />
          {t('common.back')}
        </Link>
        <div className="card card--pad empty" style={{ marginTop: '1rem' }}>
          <p>{t('ticketDetail.notFound')}</p>
        </div>
      </section>
    );

  const tk = ticket;
  const custName = customer?.name ?? t('common.unknownCustomer');
  // Ticket-level notes: on the ticket but not tied to a specific event or call.
  const ticketNotes = notes.filter((n) => n.ticketId === ticketId && n.eventId === undefined && n.callId === undefined);

  async function setStatus(status: TicketStatus) {
    setError(null);
    try {
      await services.setTicketStatus(ticketId, status);
    } catch {
      setError(t('ticketDetail.saveFailed'));
    }
  }

  async function saveSubject() {
    const next = subjectDraft.trim();
    setEditingSubject(false);
    if (next === (tk.subject ?? '')) return;
    try {
      await services.setTicketSubject(ticketId, next);
    } catch {
      setError(t('ticketDetail.saveFailed'));
    }
  }

  return (
    <section>
      <Link to={backTo} className="btn btn--ghost btn--sm" style={{ marginBottom: '0.8rem' }}>
        <Icon name="back" size={16} />
        {t('common.back')}
      </Link>

      <div className="detail-head">
        <div className="detail-head__main">
          {editingSubject ? (
            <form className="subject-edit" onSubmit={(e) => { e.preventDefault(); void saveSubject(); }}>
              <input
                type="text"
                autoFocus
                value={subjectDraft}
                placeholder={t('tickets.noSubject')}
                onChange={(e) => setSubjectDraft(e.target.value)}
                onBlur={() => void saveSubject()}
              />
              <button type="submit" className="btn btn--primary btn--sm">{t('ticketDetail.save')}</button>
            </form>
          ) : (
            <button
              type="button"
              className="subject-view"
              title={t('ticketDetail.editSubject')}
              onClick={() => { setSubjectDraft(tk.subject ?? ''); setEditingSubject(true); }}
            >
              <h1>{tk.subject ?? t('tickets.noSubject')}</h1>
              <Icon name="plus" size={14} />
            </button>
          )}
          <Link to={`/customers/${tk.customerId}`} className="detail-head__cust">
            <Avatar name={customer?.name ?? customer?.phones[0]} size={26} />
            <span>{custName}</span>
          </Link>
        </div>

        <div className="detail-head__actions">
          <PinButton pinned={tk.pinned === true} onToggle={(next) => void services.setTicketPinned(ticketId, next)} />
          <div className="segmented" role="group" aria-label={t('ticketDetail.status')}>
            {STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                className={`segmented__btn${tk.status === s ? ' is-active' : ''}`}
                onClick={() => void setStatus(s)}
              >
                {t(`ticket.status.${s}`)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="detail-meta muted">
        <span>{t('ticketDetail.opened')}: {formatDateTime(tk.openedAt, locale)}</span>
        <span>{t('ticketDetail.lastActivity')}: {relativeTime(tk.lastActivityAt, locale)}</span>
      </div>

      {error !== null && <p className="error">{error}</p>}

      <div className="grid-2" style={{ marginTop: '1rem' }}>
        {/* Interaction timeline — calls, emails, meetings on this ticket. */}
        <div className="card card--pad">
          <h2>{t('ticketDetail.timeline')}</h2>
          {companyId !== undefined && customerId !== undefined && (
            <InteractionLogger companyId={companyId} customerId={customerId} ticketId={ticketId} author={profile?.email} />
          )}

          {timeline.length === 0 ? (
            <p className="muted" style={{ marginTop: '1rem' }}>{t('ticketDetail.noActivity')}</p>
          ) : (
            <ul className="events" style={{ marginTop: '1rem' }}>
              {timeline.map((item) => {
                const c = item.call;
                const e = item.event;
                const anchorKey = c ? `call:${c.id}` : `event:${e?.id}`;
                const itemNotes = c
                  ? notes.filter((n) => n.callId === c.id)
                  : notes.filter((n) => n.eventId === e?.id);
                return (
                  <li key={item.key} className="event">
                    <div className="event__row">
                      {c ? (
                        <>
                          <span className={`badge badge--${c.status}`}>{t(`call.status.${c.status}`)}</span>
                          <Link to={linkTo(`/calls/${c.id}`)} className="grow link">
                            {t(`call.direction.${c.direction}`)} · {c.callerNumber ?? t('common.unknownCustomer')}
                          </Link>
                          <span className="muted">{relativeTime(c.startTime, locale)}</span>
                        </>
                      ) : (
                        <>
                          <span className={`badge badge--${e?.type}`}>{t(`event.type.${e?.type}`)}</span>
                          <span className="grow">{e?.summary}</span>
                          <span className="muted">{relativeTime(e?.at, locale)}</span>
                        </>
                      )}
                    </div>
                    {/* Recording / voicemail, playable right next to the call. */}
                    {c?.recordingUrl !== undefined && (
                      <audio className="event__audio" controls preload="none" src={c.recordingUrl} />
                    )}
                    <div className="event__actions">
                      <button type="button" className="btn btn--sm btn--ghost" onClick={() => setNoteFor(noteFor === anchorKey ? null : anchorKey)}>
                        <Icon name="plus" size={13} />
                        {t('note.add')}
                      </button>
                      <MoveTo
                        currentTicketId={ticketId}
                        tickets={allTickets}
                        onMove={(to) => (c ? void services.moveCall(c.id, to) : e ? void services.moveEvent(e.id, to) : undefined)}
                        {...(companyId !== undefined && customerId !== undefined
                          ? {
                              onMoveToNew: () => {
                                void (async () => {
                                  const id = await services.createTicket(companyId, customerId);
                                  if (c) await services.moveCall(c.id, id);
                                  else if (e) await services.moveEvent(e.id, id);
                                })();
                              },
                            }
                          : {})}
                      />
                    </div>
                    {noteFor === anchorKey && companyId !== undefined && customerId !== undefined && (
                      <div className="event__note">
                        <NoteComposer
                          companyId={companyId}
                          customerId={customerId}
                          ticketId={ticketId}
                          {...(c ? { callId: c.id } : { eventId: e?.id })}
                          author={profile?.email}
                          compact
                        />
                      </div>
                    )}
                    {itemNotes.length > 0 && <NotesList notes={itemNotes} />}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Ticket notes — commentary on the ticket itself. */}
        <div className="card card--pad">
          <h2>{t('ticketDetail.notesTitle')}</h2>
          {companyId !== undefined && customerId !== undefined && (
            <NoteComposer companyId={companyId} customerId={customerId} ticketId={ticketId} author={profile?.email} />
          )}
          {ticketNotes.length === 0 ? (
            <p className="muted" style={{ marginTop: '0.8rem' }}>{t('ticketDetail.noNotes')}</p>
          ) : (
            <div style={{ marginTop: '0.8rem' }}>
              <NotesList notes={ticketNotes} />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
