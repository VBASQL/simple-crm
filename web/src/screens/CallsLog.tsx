import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider.js';
import { useServices } from '../services/ServicesContext.js';
import { useI18n } from '../i18n/i18n.js';
import { useLinkTo } from '../nav.js';
import { relativeTime } from '../format.js';
import { Avatar } from '../components/Avatar.js';
import { Icon } from '../components/Icon.js';
import type { Call, Customer, Ticket } from '../types.js';

export function CallsLog() {
  const { profile } = useAuth();
  const services = useServices();
  const { t, locale } = useI18n();
  const linkTo = useLinkTo();
  const [calls, setCalls] = useState<Call[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [q, setQ] = useState('');

  const companyId = profile?.companyId;
  useEffect(() => {
    if (companyId === undefined) return;
    const unsubs = [
      services.subscribeRecentCalls(companyId, setCalls),
      services.subscribeCustomers(companyId, setCustomers),
      services.subscribeTickets(companyId, setTickets),
    ];
    return () => unsubs.forEach((u) => u());
  }, [services, companyId]);

  const nameOf = useMemo(() => {
    const map = new Map(customers.map((c) => [c.id, c.name]));
    return (id: string) => map.get(id);
  }, [customers]);
  const subjectOf = useMemo(() => {
    const map = new Map(tickets.map((tk) => [tk.id, tk.subject]));
    return (id?: string) => (id === undefined ? undefined : map.get(id));
  }, [tickets]);

  const stats = useMemo(
    () => ({
      total: calls.length,
      answered: calls.filter((c) => c.status === 'answered').length,
      missed: calls.filter((c) => c.status === 'missed' || c.status === 'voicemail').length,
    }),
    [calls],
  );

  const needle = q.trim().toLowerCase();
  const visible = useMemo(
    () =>
      needle === ''
        ? calls
        : calls.filter((c) =>
            [c.callerNumber ?? '', c.didNumber ?? '', nameOf(c.customerId) ?? '', subjectOf(c.ticketId) ?? ''].some((v) =>
              v.toLowerCase().includes(needle),
            ),
          ),
    [calls, needle, nameOf, subjectOf],
  );

  return (
    <section>
      <div className="page-head">
        <h1>{t('callsLog.title')}</h1>
        <div className="search">
          <Icon name="search" size={16} />
          <input type="text" placeholder={t('callsLog.search')} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      <div className="stats">
        <div className="stat">
          <div className="stat__label">{t('stats.calls')}</div>
          <div className="stat__value">{stats.total}</div>
        </div>
        <div className="stat">
          <div className="stat__label">{t('call.status.answered')}</div>
          <div className="stat__value">{stats.answered}</div>
        </div>
        <div className="stat">
          <div className="stat__label">{t('stats.missed')}</div>
          <div className="stat__value">{stats.missed}</div>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="card card--pad empty">
          <span className="empty__icon">
            <Icon name="calls" size={22} />
          </span>
          <p>{calls.length === 0 ? t('callsLog.empty') : t('customers.noMatch')}</p>
        </div>
      ) : (
        <ul className="events card card--pad">
          {visible.map((c) => {
            const name = nameOf(c.customerId);
            return (
              <li key={c.id} className="event">
                <div className="event__row">
                  <Avatar name={name ?? c.callerNumber} size={30} />
                  <Link to={linkTo(`/calls/${c.id}`)} className="grow link">
                    <b>{name ?? t('common.unknownCustomer')}</b>
                    <span className="muted"> · {c.callerNumber ?? ''}</span>
                  </Link>
                  <span className="muted">{t(`call.direction.${c.direction}`)}</span>
                  <span className={`badge badge--${c.status}`}>{t(`call.status.${c.status}`)}</span>
                  {c.ticketId !== undefined && (
                    <Link to={linkTo(`/tickets/${c.ticketId}`)} className="chip">
                      {subjectOf(c.ticketId) ?? t('tickets.noSubject')}
                    </Link>
                  )}
                  <span className="muted">{relativeTime(c.startTime, locale)}</span>
                </div>
                {c.recordingUrl !== undefined && (
                  <audio className="event__audio" controls preload="none" src={c.recordingUrl} />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
