import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider.js';
import { useServices } from '../services/ServicesContext.js';
import { useI18n } from '../i18n/i18n.js';
import { useLinkTo } from '../nav.js';
import { Avatar } from '../components/Avatar.js';
import { Icon } from '../components/Icon.js';
import type { Customer, RingingDoc } from '../types.js';

/** mm:ss a caller has been waiting. */
function waited(from: Date | undefined, now: number): string {
  if (from === undefined) return '';
  const s = Math.max(0, Math.round((now - from.getTime()) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Live queue board: everyone currently ringing/waiting, grouped by queue,
 * longest-waiting first. Built on the `ringing` collection the webhook already
 * fills (one doc per active call, deleted on answer/hangup). Open a waiting
 * call to its page to take notes; the phone/PBX still does the answering.
 */
export function Queue() {
  const { profile } = useAuth();
  const services = useServices();
  const { t } = useI18n();
  const linkTo = useLinkTo();
  const [ringing, setRinging] = useState<RingingDoc[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [now, setNow] = useState(Date.now());

  const companyId = profile?.companyId;
  useEffect(() => {
    if (companyId === undefined) return;
    const unsubs = [services.subscribeRinging(companyId, setRinging), services.subscribeCustomers(companyId, setCustomers)];
    return () => unsubs.forEach((u) => u());
  }, [services, companyId]);

  // Tick so wait times count up live.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const nameOf = useMemo(() => {
    const m = new Map(customers.map((c) => [c.id, c.name]));
    return (id: string) => m.get(id);
  }, [customers]);

  // Live (not past expiry), longest-waiting first — that is the order to answer.
  const live = useMemo(
    () =>
      ringing
        .filter((r) => r.expiresAt === undefined || r.expiresAt.getTime() > now)
        .sort((a, b) => (a.startedAt?.getTime() ?? 0) - (b.startedAt?.getTime() ?? 0)),
    [ringing, now],
  );

  const groups = useMemo(() => {
    const m = new Map<string, RingingDoc[]>();
    for (const r of live) {
      const key = r.queueName ?? '';
      const arr = m.get(key);
      if (arr) arr.push(r);
      else m.set(key, [r]);
    }
    return [...m.entries()];
  }, [live]);

  return (
    <section>
      <div className="page-head">
        <h1>{t('queue.title')}</h1>
        {live.length > 0 && <span className="chip">{live.length}</span>}
      </div>

      {live.length === 0 ? (
        <div className="card card--pad empty">
          <span className="empty__icon">
            <Icon name="phone" size={22} />
          </span>
          <p>{t('queue.empty')}</p>
        </div>
      ) : (
        groups.map(([queue, rows]) => (
          <div className="card card--pad" key={queue || '_none'} style={{ marginBottom: '1rem' }}>
            <div className="group-head">
              <h2>{queue === '' ? t('queue.noQueue') : queue}</h2>
              <span className="chip">{rows.length}</span>
            </div>
            <ul className="events">
              {rows.map((r) => {
                const name = nameOf(r.customerId);
                return (
                  <li key={r.id} className="event">
                    <div className="event__row">
                      <Avatar name={name ?? r.callerNumber} size={34} />
                      <div className="grow">
                        <b>{name ?? t('popup.newCustomer')}</b>
                        <div className="muted mono">
                          {r.callerNumber ?? ''}
                          {r.didNumber !== undefined ? ` → ${r.didNumber}` : ''}
                        </div>
                      </div>
                      <span className="badge badge--ringing live" title={t('queue.waiting')}>
                        {waited(r.startedAt, now)}
                      </span>
                      <Link to={linkTo(`/customers/${r.customerId}`)} className="btn btn--sm">
                        {t('popup.openCustomer')}
                      </Link>
                      <Link to={linkTo(`/calls/${r.id}`)} className="btn btn--sm btn--primary">
                        {t('queue.open')}
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}
