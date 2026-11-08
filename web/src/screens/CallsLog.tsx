import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider.js';
import { useServices } from '../services/ServicesContext.js';
import { useI18n } from '../i18n/i18n.js';
import { formatDateTime } from '../format.js';
import type { Call } from '../types.js';

export function CallsLog() {
  const { profile } = useAuth();
  const services = useServices();
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const [calls, setCalls] = useState<Call[]>([]);

  const companyId = profile?.companyId;
  useEffect(() => {
    if (companyId === undefined) return;
    return services.subscribeRecentCalls(companyId, setCalls);
  }, [services, companyId]);

  return (
    <section>
      <h1>{t('callsLog.title')}</h1>
      {calls.length === 0 ? (
        <p className="muted">{t('callsLog.empty')}</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>{t('callsLog.when')}</th>
              <th>{t('callsLog.caller')}</th>
              <th>{t('callsLog.direction')}</th>
              <th>{t('callsLog.status')}</th>
            </tr>
          </thead>
          <tbody>
            {calls.map((c) => (
              <tr key={c.id} className="row" onClick={() => navigate(`/customers/${c.customerId}`)}>
                <td>{formatDateTime(c.startTime, locale)}</td>
                <td>{c.callerNumber ?? ''}</td>
                <td>{t(`call.direction.${c.direction}`)}</td>
                <td>
                  <span className={`badge badge--${c.status}`}>{t(`call.status.${c.status}`)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
