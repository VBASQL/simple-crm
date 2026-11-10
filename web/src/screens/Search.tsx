import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider.js';
import { useServices } from '../services/ServicesContext.js';
import { useI18n } from '../i18n/i18n.js';
import { relativeTime } from '../format.js';
import { Avatar } from '../components/Avatar.js';
import { Icon } from '../components/Icon.js';
import type { Call, Customer, Ticket } from '../types.js';

// One global search across the three things an agent looks for: a person, an
// open issue, or a call. Firestore has no full-text index, so we match
// client-side over the company's live data — correct and instant at the scale
// a single company's recent data sits at (calls are already capped at 100 by
// subscribeRecentCalls). If a company outgrows this, move to a search index;
// the screen's contract (a query in, grouped hits out) would not change.
export function Search() {
  const { profile } = useAuth();
  const services = useServices();
  const { t, locale } = useI18n();
  const navigate = useNavigate();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [calls, setCalls] = useState<Call[]>([]);
  const [q, setQ] = useState('');

  const companyId = profile?.companyId;
  useEffect(() => {
    if (companyId === undefined) return;
    const unsubs = [
      services.subscribeCustomers(companyId, setCustomers),
      services.subscribeTickets(companyId, setTickets),
      services.subscribeRecentCalls(companyId, setCalls),
    ];
    return () => unsubs.forEach((u) => u());
  }, [services, companyId]);

  // Customer name is the handle an agent recognises, so tickets and calls are
  // searchable by their customer's name too, not only their own fields.
  const nameOf = useMemo(() => {
    const map = new Map(customers.map((c) => [c.id, c.name]));
    return (id: string): string | undefined => map.get(id);
  }, [customers]);

  const needle = q.trim().toLowerCase();
  const hits = (hay: (string | undefined)[]): boolean =>
    needle !== '' && hay.some((v) => (v ?? '').toLowerCase().includes(needle));

  const custHits = useMemo(
    () => customers.filter((c) => hits([c.name, ...c.phones, ...c.emails])),
    [customers, needle], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const tickHits = useMemo(
    () => tickets.filter((tk) => hits([tk.subject, nameOf(tk.customerId)])),
    [tickets, nameOf, needle], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const callHits = useMemo(
    () => calls.filter((c) => hits([c.callerNumber, c.didNumber, nameOf(c.customerId)])),
    [calls, nameOf, needle], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const total = custHits.length + tickHits.length + callHits.length;

  return (
    <section>
      <div className="page-head">
        <h1>{t('search.title')}</h1>
        <div className="search">
          <Icon name="search" size={16} />
          {/* Autofocus: the agent came here to type, so take the cursor. */}
          <input
            type="text"
            autoFocus
            placeholder={t('search.placeholder')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      {needle === '' ? (
        <div className="card card--pad empty">
          <span className="empty__icon">
            <Icon name="search" size={22} />
          </span>
          <p>{t('search.hint')}</p>
        </div>
      ) : total === 0 ? (
        <div className="card card--pad empty">
          <span className="empty__icon">
            <Icon name="search" size={22} />
          </span>
          <p>{t('search.empty')}</p>
        </div>
      ) : (
        <div className="stack">
          {custHits.length > 0 && (
            <Group label={t('search.customers')} count={custHits.length}>
              {custHits.map((c) => (
                <button key={c.id} type="button" className="result" onClick={() => navigate(`/customers/${c.id}`)}>
                  <Avatar name={c.name ?? c.phones[0]} size={32} />
                  <div className="result__main">
                    <b>{c.name ?? t('common.unknownCustomer')}</b>
                    <span className="muted">{[c.phones[0], c.emails[0]].filter(Boolean).join(' · ')}</span>
                  </div>
                  <span className="muted">{relativeTime(c.lastContactAt, locale)}</span>
                </button>
              ))}
            </Group>
          )}

          {tickHits.length > 0 && (
            <Group label={t('search.tickets')} count={tickHits.length}>
              {tickHits.map((tk) => (
                <button
                  key={tk.id}
                  type="button"
                  className="result"
                  onClick={() => navigate(`/tickets/${tk.id}`)}
                >
                  <span className={`badge badge--${tk.status}`}>{t(`ticket.status.${tk.status}`)}</span>
                  <div className="result__main">
                    <b>{tk.subject ?? t('tickets.noSubject')}</b>
                    <span className="muted">{nameOf(tk.customerId) ?? t('common.unknownCustomer')}</span>
                  </div>
                  <span className="muted">{relativeTime(tk.lastActivityAt, locale)}</span>
                </button>
              ))}
            </Group>
          )}

          {callHits.length > 0 && (
            <Group label={t('search.calls')} count={callHits.length}>
              {callHits.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="result"
                  onClick={() => navigate(`/customers/${c.customerId}`)}
                >
                  <span className={`badge badge--${c.status}`}>{t(`call.status.${c.status}`)}</span>
                  <div className="result__main">
                    <b>{nameOf(c.customerId) ?? c.callerNumber ?? t('common.unknownCustomer')}</b>
                    <span className="muted">
                      {t(`call.direction.${c.direction}`)} · {c.callerNumber ?? ''}
                    </span>
                  </div>
                  <span className="muted">{relativeTime(c.startTime, locale)}</span>
                </button>
              ))}
            </Group>
          )}
        </div>
      )}
    </section>
  );
}

function Group({ label, count, children }: { label: string; count: number; children: React.ReactNode }) {
  return (
    <div className="card card--pad">
      <div className="group-head">
        <h2>{label}</h2>
        <span className="chip">{count}</span>
      </div>
      <div className="results">{children}</div>
    </div>
  );
}
