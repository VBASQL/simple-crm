import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider.js';
import { useServices } from '../services/ServicesContext.js';
import { useI18n } from '../i18n/i18n.js';
import { relativeTime } from '../format.js';
import { Avatar } from '../components/Avatar.js';
import { Icon } from '../components/Icon.js';
import type { Customer, Ticket, TicketStatus } from '../types.js';

type Filter = 'all' | 'open' | 'closed';

export function Tickets() {
  const { profile } = useAuth();
  const services = useServices();
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filter, setFilter] = useState<Filter>('open');

  const companyId = profile?.companyId;
  useEffect(() => {
    if (companyId === undefined) return;
    const unsubs = [services.subscribeTickets(companyId, setTickets), services.subscribeCustomers(companyId, setCustomers)];
    return () => unsubs.forEach((u) => u());
  }, [services, companyId]);

  const nameOf = useMemo(() => {
    const map = new Map(customers.map((c) => [c.id, c.name]));
    return (id: string) => map.get(id);
  }, [customers]);

  const matches = (s: TicketStatus): boolean =>
    filter === 'all' || (filter === 'open' ? s !== 'closed' : s === 'closed');
  const visible = tickets.filter((tk) => matches(tk.status));

  return (
    <section>
      <div className="page-head">
        <h1>{t('tickets.title')}</h1>
      </div>

      <div className="tabs">
        {(['open', 'closed', 'all'] as Filter[]).map((f) => (
          <button key={f} type="button" className={`tab${filter === f ? ' is-active' : ''}`} onClick={() => setFilter(f)}>
            {t(`tickets.filter.${f}`)}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="card card--pad empty">
          <span className="empty__icon">
            <Icon name="tickets" size={22} />
          </span>
          <p>{t('tickets.empty')}</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t('tickets.subject')}</th>
                <th>{t('tickets.customer')}</th>
                <th>{t('tickets.statusCol')}</th>
                <th>{t('tickets.updated')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((tk) => {
                const name = nameOf(tk.customerId);
                const closed = tk.status === 'closed';
                return (
                  <tr key={tk.id} className="row" onClick={() => navigate(`/tickets/${tk.id}`)}>
                    <td>
                      <div className="cell-main">
                        {tk.pinned === true && <Icon name="star" size={13} />}
                        <b>{tk.subject ?? t('tickets.noSubject')}</b>
                      </div>
                    </td>
                    <td>
                      <div className="cell-main">
                        <Avatar name={name} size={28} />
                        <span className="muted">{name ?? t('common.unknownCustomer')}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge badge--${tk.status}`}>{t(`ticket.status.${tk.status}`)}</span>
                    </td>
                    <td className="muted">{relativeTime(tk.lastActivityAt, locale)}</td>
                    <td style={{ textAlign: 'end' }}>
                      {/* Quick close / reopen without opening the ticket. */}
                      <button
                        type="button"
                        className="btn btn--sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          void services.setTicketStatus(tk.id, closed ? 'open' : 'closed');
                        }}
                      >
                        {closed ? t('ticket.reopen') : t('ticket.close')}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
