import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider.js';
import { useServices } from '../services/ServicesContext.js';
import { useI18n } from '../i18n/i18n.js';
import { formatDateTime, relativeTime } from '../format.js';
import { Avatar } from '../components/Avatar.js';
import { Icon } from '../components/Icon.js';
import { NoteComposer } from '../components/NoteComposer.js';
import { NotesList } from '../components/NotesList.js';
import { MoveTo } from '../components/MoveEvent.js';
import type { Call, Customer, Note, Ticket, TimelineEvent } from '../types.js';

const backLabelFor = (path: string): 'call.backToTicket' | 'call.back' =>
  path.includes('/tickets/') ? 'call.backToTicket' : 'call.back';

/** mm:ss for a duration in seconds; empty when unknown. */
function duration(seconds: number | undefined): string {
  if (seconds === undefined) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function CallDetail() {
  const { callId = '' } = useParams();
  const [params] = useSearchParams();
  const { profile } = useAuth();
  const services = useServices();
  const { t, locale } = useI18n();

  // `back` carries the full path the call was opened from (a ticket, the calls
  // log, search…), so Back always returns to the origin. Falls back to the
  // call's own ticket, then the calls log.
  const backParam = params.get('back') ?? undefined;

  const [call, setCall] = useState<Call | null | undefined>(undefined);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [allTickets, setAllTickets] = useState<Ticket[]>([]);

  const companyId = profile?.companyId;

  useEffect(() => services.subscribeCall(callId, setCall), [services, callId]);

  const customerId = call?.customerId;
  useEffect(() => {
    if (customerId === undefined) return;
    void services.getCustomer(customerId).then(setCustomer);
  }, [services, customerId]);

  // The customer's timeline + notes, filtered to this call: the CDR event (via
  // payload.callId) and every note anchored to this call (note.callId).
  useEffect(() => {
    if (companyId === undefined || customerId === undefined) return;
    const unsubs = [
      services.subscribeCustomerEvents(companyId, customerId, setEvents),
      services.subscribeNotes(companyId, customerId, setNotes),
      services.subscribeCustomerTickets(companyId, customerId, setAllTickets),
    ];
    return () => unsubs.forEach((u) => u());
  }, [services, companyId, customerId]);

  const callEvents = useMemo(
    () => events.filter((e) => (e.payload as { callId?: string } | undefined)?.callId === callId),
    [events, callId],
  );
  const callNotes = useMemo(() => notes.filter((n) => n.callId === callId), [notes, callId]);

  if (call === undefined) return <p className="muted">{t('common.loading')}</p>;
  if (call === null)
    return (
      <section>
        <Link to={backParam ?? '/'} className="btn btn--ghost btn--sm">
          <Icon name="back" size={16} />
          {t(backLabelFor(backParam ?? '/'))}
        </Link>
        <div className="card card--pad empty" style={{ marginTop: '1rem' }}>
          <p>{t('call.notFound')}</p>
        </div>
      </section>
    );

  const c = call;
  const custName = customer?.name ?? t('common.unknownCustomer');
  const isLive = c.status === 'ringing';
  const backTo = backParam ?? (c.ticketId !== undefined ? `/tickets/${c.ticketId}` : '/');

  return (
    <section>
      <Link to={backTo} className="btn btn--ghost btn--sm" style={{ marginBottom: '0.8rem' }}>
        <Icon name="back" size={16} />
        {t(backLabelFor(backTo))}
      </Link>

      <div className="detail-head">
        <div className="detail-head__main">
          <div className="call-title">
            <Avatar name={customer?.name ?? c.callerNumber} size={40} />
            <div>
              <Link to={`/customers/${c.customerId}`} className="link">
                <h1>{custName}</h1>
              </Link>
              <div className="muted mono">{c.callerNumber ?? ''}</div>
            </div>
          </div>
        </div>
        <div className="call-badges">
          {isLive && <span className="badge badge--ringing live">{t('call.live')}</span>}
          <span className={`badge badge--${c.status}`}>{t(`call.status.${c.status}`)}</span>
          <span className="badge">{t(`call.direction.${c.direction}`)}</span>
          {/* Same move option as the call has inside a ticket. */}
          {companyId !== undefined && (
            <MoveTo
              currentTicketId={c.ticketId}
              tickets={allTickets}
              onMove={(to) => void services.moveCall(c.id, to)}
              onMoveToNew={() => {
                void (async () => {
                  const id = await services.createTicket(companyId, c.customerId);
                  await services.moveCall(c.id, id);
                })();
              }}
            />
          )}
        </div>
      </div>

      <div className="detail-meta muted">
        <span>{formatDateTime(c.startTime, locale)}</span>
        {duration(c.duration) !== '' && (
          <span>
            {t('call.duration')}: {duration(c.duration)}
          </span>
        )}
        {c.answeringExtension !== undefined && (
          <span>
            {t('call.extension')}: {c.answeringExtension}
          </span>
        )}
        {c.ticketId !== undefined && (
          <Link to={`/tickets/${c.ticketId}`} className="link">
            {t('call.ticket')}
          </Link>
        )}
      </div>

      {/* Recording — rendered whenever the CDR carried a playback URL. Whether
          the link needs Globalex auth is still an open question with them; the
          player degrades to a plain link if the browser can't stream it. */}
      {c.recordingUrl !== undefined && (
        <div className="card card--pad" style={{ marginTop: '1rem' }}>
          <h2>{t('call.recording')}</h2>
          <audio controls preload="none" src={c.recordingUrl} style={{ width: '100%' }} />
          <a href={c.recordingUrl} target="_blank" rel="noreferrer" className="link" style={{ fontSize: '0.85rem' }}>
            {t('call.openRecording')}
          </a>
        </div>
      )}

      <div className="card card--pad" style={{ marginTop: '1rem' }}>
        <h2>{t('call.notesTitle')}</h2>
        <p className="muted" style={{ marginTop: '-0.4rem', marginBottom: '0.8rem' }}>
          {t('call.notesHint')}
        </p>

        {companyId !== undefined && (
          <NoteComposer companyId={companyId} customerId={c.customerId} callId={callId} author={profile?.email} />
        )}

        {callNotes.length > 0 && (
          <div style={{ marginTop: '1rem' }}>
            <NotesList notes={callNotes} />
          </div>
        )}

        {callEvents.length > 0 && (
          <ul className="timeline" style={{ marginTop: '1rem' }}>
            {callEvents.map((e) => (
              <li key={e.id}>
                <span className={`badge badge--${e.type}`}>{t(`event.type.${e.type}`)}</span>
                <span className="grow">{e.summary}</span>
                <span className="muted">{relativeTime(e.at, locale)}</span>
              </li>
            ))}
          </ul>
        )}

        {callNotes.length === 0 && callEvents.length === 0 && (
          <p className="muted" style={{ marginTop: '1rem' }}>{t('call.noNotes')}</p>
        )}
      </div>
    </section>
  );
}
