import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider.js';
import { useServices } from '../services/ServicesContext.js';
import { useI18n } from '../i18n/i18n.js';
import { relativeTime } from '../format.js';
import { Avatar } from '../components/Avatar.js';
import { Icon } from '../components/Icon.js';
import type { Call, Customer } from '../types.js';

export function CallsLog() {
  const { profile } = useAuth();
  const services = useServices();
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const [calls, setCalls] = useState<Call[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  const companyId = profile?.companyId;
  useEffect(() => {
    if (companyId === undefined) return;
    const unsubs = [services.subscribeRecentCalls(companyId, setCalls), services.subscribeCustomers(companyId, setCustomers)];
    return () => unsubs.forEach((u) => u());
  }, [services, companyId]);

  const nameOf = useMemo(() => {
    const map = new Map(customers.map((c) => [c.id, c.name]));
    return (id: string) => map.get(id);
  }, [customers]);

  const stats = useMemo(
    () => ({
      total: calls.length,
      answered: calls.filter((c) => c.status === 'answered').length,
      missed: calls.filter((c) => c.status === 'missed' || c.status === 'voicemail').length,
    }),
    [calls],
  );

  return (
    <section>
      <div className="page-head">
        <h1>{t('callsLog.title')}</h1>
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

      {calls.length === 0 ? (
        <Empty />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t('callsLog.caller')}</th>
                <th>{t('callsLog.direction')}</th>
                <th>{t('callsLog.status')}</th>
                <th>{t('callsLog.when')}</th>
              </tr>
            </thead>
            <tbody>
              {calls.map((c) => {
                const name = nameOf(c.customerId);
                return (
                  <tr key={c.id} className="row" onClick={() => navigate(`/calls/${c.id}`)}>
                    <td>
                      <div className="cell-main">
                        <Avatar name={name ?? c.callerNumber} size={32} />
                        <div>
                          <b>{name ?? t('common.unknownCustomer')}</b>
                          <div className="muted">{c.callerNumber ?? ''}</div>
                        </div>
                      </div>
                    </td>
                    <td className="muted">{t(`call.direction.${c.direction}`)}</td>
                    <td>
                      <span className={`badge badge--${c.status}`}>{t(`call.status.${c.status}`)}</span>
                    </td>
                    <td className="muted">{relativeTime(c.startTime, locale)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );

  function Empty() {
    return (
      <div className="card card--pad empty">
        <span className="empty__icon">
          <Icon name="calls" size={22} />
        </span>
        <p>{t('callsLog.empty')}</p>
      </div>
    );
  }
}
