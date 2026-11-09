import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider.js';
import { useServices } from '../services/ServicesContext.js';
import { useI18n } from '../i18n/i18n.js';
import { relativeTime, formatDateTime } from '../format.js';
import { Avatar } from '../components/Avatar.js';
import { Icon } from '../components/Icon.js';
import type { Call, Customer, Ticket, TimelineEvent } from '../types.js';

type Tab = 'timeline' | 'tickets' | 'calls';

export function CustomerPage() {
  const { customerId = '' } = useParams();
  const { profile } = useAuth();
  const services = useServices();
  const { t, locale } = useI18n();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [calls, setCalls] = useState<Call[]>([]);
  const [tab, setTab] = useState<Tab>('timeline');

  const companyId = profile?.companyId;

  useEffect(() => {
    void services.getCustomer(customerId).then(setCustomer);
  }, [services, customerId]);

  useEffect(() => {
    if (companyId === undefined) return;
    const unsubs = [
      services.subscribeCustomerEvents(companyId, customerId, setEvents),
      services.subscribeCustomerTickets(companyId, customerId, setTickets),
      services.subscribeCustomerCalls(companyId, customerId, setCalls),
    ];
    return () => unsubs.forEach((u) => u());
  }, [services, companyId, customerId]);

  const name = customer?.name ?? t('common.unknownCustomer');

  return (
    <section>
      <Link to="/customers" className="btn btn--ghost btn--sm" style={{ marginBottom: '0.8rem' }}>
        <Icon name="back" size={16} />
        {t('customer.back')}
      </Link>

      <div className="customer-head">
        <Avatar name={customer?.name ?? customer?.phones[0]} size={56} />
        <div>
          <h1>{name}</h1>
          <div className="customer-head__meta">
            {customer?.phones[0] !== undefined && (
              <span>
                <Icon name="phone" size={14} /> {customer.phones.join(', ')}
              </span>
            )}
            {customer?.emails[0] !== undefined && (
              <span>
                <Icon name="mail" size={14} /> {customer.emails.join(', ')}
              </span>
            )}
          </div>
          {customer && customer.tags.length > 0 && (
            <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem' }}>
              {customer.tags.map((tg) => (
                <span key={tg} className="chip">
                  {tg}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="tabs">
        {(['timeline', 'tickets', 'calls'] as Tab[]).map((x) => (
          <button key={x} type="button" className={`tab${tab === x ? ' is-active' : ''}`} onClick={() => setTab(x)}>
            {t(`customer.${x}`)}
          </button>
        ))}
      </div>

      <div className="card card--pad">
        {tab === 'timeline' &&
          (events.length === 0 ? (
            <p className="muted">{t('customer.noEvents')}</p>
          ) : (
            <ul className="timeline">
              {events.map((e) => (
                <li key={e.id}>
                  <span className={`badge badge--${e.type}`}>{e.type}</span>
                  <span className="grow">{e.summary}</span>
                  <span className="muted">{relativeTime(e.at, locale)}</span>
                </li>
              ))}
            </ul>
          ))}

        {tab === 'tickets' &&
          (tickets.length === 0 ? (
            <p className="muted">{t('customer.noTickets')}</p>
          ) : (
            <ul className="list">
              {tickets.map((tk) => (
                <li key={tk.id}>
                  <span className={`badge badge--${tk.status}`}>{t(`ticket.status.${tk.status}`)}</span>
                  <span className="grow">{tk.subject ?? t('tickets.noSubject')}</span>
                  <span className="muted">{relativeTime(tk.lastActivityAt, locale)}</span>
                </li>
              ))}
            </ul>
          ))}

        {tab === 'calls' &&
          (calls.length === 0 ? (
            <p className="muted">{t('callsLog.empty')}</p>
          ) : (
            <ul className="list">
              {calls.map((c) => (
                <li key={c.id}>
                  <span className={`badge badge--${c.status}`}>{t(`call.status.${c.status}`)}</span>
                  <span className="grow">{c.callerNumber ?? ''}</span>
                  <span className="muted">{formatDateTime(c.startTime, locale)}</span>
                </li>
              ))}
            </ul>
          ))}
      </div>
    </section>
  );
}
