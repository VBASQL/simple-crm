import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider.js';
import { useServices } from '../services/ServicesContext.js';
import { useI18n } from '../i18n/i18n.js';
import { formatDateTime } from '../format.js';
import type { Call, Customer, Ticket, TimelineEvent } from '../types.js';

export function CustomerPage() {
  const { customerId = '' } = useParams();
  const { profile } = useAuth();
  const services = useServices();
  const { t, locale } = useI18n();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [calls, setCalls] = useState<Call[]>([]);

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
    <section className="customer">
      <Link to="/" className="muted">
        ← {t('customer.back')}
      </Link>
      <header className="customer__header">
        <h1>{name}</h1>
        <div className="muted">{customer?.phones.join(', ')}</div>
        <div className="muted">{customer?.emails.join(', ')}</div>
      </header>

      <div className="columns">
        <div className="card">
          <h2>{t('customer.timeline')}</h2>
          {events.length === 0 ? (
            <p className="muted">{t('customer.noEvents')}</p>
          ) : (
            <ul className="timeline">
              {events.map((e) => (
                <li key={e.id}>
                  <span className={`badge badge--${e.type}`}>{e.type}</span>
                  <span>{e.summary}</span>
                  <span className="muted">{formatDateTime(e.at, locale)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <h2>{t('customer.tickets')}</h2>
          {tickets.length === 0 ? (
            <p className="muted">{t('customer.noTickets')}</p>
          ) : (
            <ul className="list">
              {tickets.map((tk) => (
                <li key={tk.id}>
                  <span className={`badge badge--${tk.status}`}>{t(`ticket.status.${tk.status}`)}</span>
                  <span>{tk.subject ?? ''}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <h2>{t('customer.calls')}</h2>
          <ul className="list">
            {calls.map((c) => (
              <li key={c.id}>
                <span className={`badge badge--${c.status}`}>{t(`call.status.${c.status}`)}</span>
                <span>{c.callerNumber ?? ''}</span>
                <span className="muted">{formatDateTime(c.startTime, locale)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
