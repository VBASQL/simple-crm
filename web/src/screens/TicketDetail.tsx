import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider.js';
import { useServices } from '../services/ServicesContext.js';
import { useI18n } from '../i18n/i18n.js';
import { relativeTime, formatDateTime } from '../format.js';
import { Avatar } from '../components/Avatar.js';
import { Icon } from '../components/Icon.js';
import { EntryComposer } from '../components/EntryComposer.js';
import type { Customer, Ticket, TicketStatus, TimelineEvent } from '../types.js';

const STATUSES: TicketStatus[] = ['open', 'pending', 'closed'];

export function TicketDetail() {
  const { ticketId = '' } = useParams();
  const { profile } = useAuth();
  const services = useServices();
  const { t, locale } = useI18n();

  const [ticket, setTicket] = useState<Ticket | null | undefined>(undefined);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [events, setEvents] = useState<TimelineEvent[]>([]);

  const [editingSubject, setEditingSubject] = useState(false);
  const [subjectDraft, setSubjectDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const companyId = profile?.companyId;

  useEffect(() => services.subscribeTicket(ticketId, setTicket), [services, ticketId]);

  useEffect(() => {
    if (companyId === undefined) return;
    return services.subscribeTicketEvents(companyId, ticketId, setEvents);
  }, [services, companyId, ticketId]);

  // Resolve the customer once we know who the ticket belongs to.
  const customerId = ticket?.customerId;
  useEffect(() => {
    if (customerId === undefined) return;
    void services.getCustomer(customerId).then(setCustomer);
  }, [services, customerId]);

  if (ticket === undefined) return <p className="muted">{t('common.loading')}</p>;
  if (ticket === null)
    return (
      <section>
        <Link to="/tickets" className="btn btn--ghost btn--sm">
          <Icon name="back" size={16} />
          {t('ticketDetail.back')}
        </Link>
        <div className="card card--pad empty" style={{ marginTop: '1rem' }}>
          <p>{t('ticketDetail.notFound')}</p>
        </div>
      </section>
    );

  const tk = ticket; // narrowed, non-null below
  const custName = customer?.name ?? t('common.unknownCustomer');

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
    setError(null);
    try {
      await services.setTicketSubject(ticketId, next);
    } catch {
      setError(t('ticketDetail.saveFailed'));
    }
  }

  return (
    <section>
      <Link to="/tickets" className="btn btn--ghost btn--sm" style={{ marginBottom: '0.8rem' }}>
        <Icon name="back" size={16} />
        {t('ticketDetail.back')}
      </Link>

      <div className="detail-head">
        <div className="detail-head__main">
          {editingSubject ? (
            <form
              className="subject-edit"
              onSubmit={(e) => {
                e.preventDefault();
                void saveSubject();
              }}
            >
              <input
                type="text"
                autoFocus
                value={subjectDraft}
                placeholder={t('tickets.noSubject')}
                onChange={(e) => setSubjectDraft(e.target.value)}
                onBlur={() => void saveSubject()}
              />
              <button type="submit" className="btn btn--primary btn--sm">
                {t('ticketDetail.save')}
              </button>
            </form>
          ) : (
            <button
              type="button"
              className="subject-view"
              title={t('ticketDetail.editSubject')}
              onClick={() => {
                setSubjectDraft(tk.subject ?? '');
                setEditingSubject(true);
              }}
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

        {/* Status picker — the one action an agent takes most, so it is the
            most prominent control on the page. */}
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

      <div className="detail-meta muted">
        <span>
          {t('ticketDetail.opened')}: {formatDateTime(tk.openedAt, locale)}
        </span>
        <span>
          {t('ticketDetail.lastActivity')}: {relativeTime(tk.lastActivityAt, locale)}
        </span>
      </div>

      {error !== null && <p className="error">{error}</p>}

      <div className="card card--pad" style={{ marginTop: '1rem' }}>
        <h2>{t('ticketDetail.notesTitle')}</h2>

        {companyId !== undefined && (
          <EntryComposer
            companyId={companyId}
            customerId={tk.customerId}
            ticketId={ticketId}
            author={profile?.email}
          />
        )}

        {events.length === 0 ? (
          <p className="muted" style={{ marginTop: '1rem' }}>
            {t('ticketDetail.noActivity')}
          </p>
        ) : (
          <ul className="timeline" style={{ marginTop: '1rem' }}>
            {events.map((e) => (
              <li key={e.id}>
                <span className={`badge badge--${e.type}`}>{t(`event.type.${e.type}`)}</span>
                <span className="grow">{e.summary}</span>
                <span className="muted">{relativeTime(e.at, locale)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
