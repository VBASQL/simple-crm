import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLinkTo } from '../nav.js';
import { useAuth } from '../auth/AuthProvider.js';
import { useServices } from '../services/ServicesContext.js';
import { useI18n } from '../i18n/i18n.js';
import { relativeTime } from '../format.js';
import { Avatar } from '../components/Avatar.js';
import { Icon } from '../components/Icon.js';
import type { Customer } from '../types.js';

export function Customers() {
  const { profile } = useAuth();
  const services = useServices();
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const linkTo = useLinkTo();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [q, setQ] = useState('');

  const companyId = profile?.companyId;
  useEffect(() => {
    if (companyId === undefined) return;
    return services.subscribeCustomers(companyId, setCustomers);
  }, [services, companyId]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (needle === '') return customers;
    return customers.filter((c) =>
      [c.name ?? '', ...c.phones, ...c.emails].some((v) => v.toLowerCase().includes(needle)),
    );
  }, [customers, q]);

  return (
    <section>
      <div className="page-head">
        <h1>{t('customers.title')}</h1>
        <div className="search">
          <Icon name="search" size={16} />
          <input type="text" placeholder={t('customers.search')} value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card card--pad empty">
          <span className="empty__icon">
            <Icon name="customers" size={22} />
          </span>
          <p>{customers.length === 0 ? t('customers.empty') : t('customers.noMatch')}</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t('customers.name')}</th>
                <th>{t('customers.phone')}</th>
                <th>{t('customers.email')}</th>
                <th>{t('customers.lastContact')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="row" onClick={() => navigate(linkTo(`/customers/${c.id}`))}>
                  <td>
                    <div className="cell-main">
                      <Avatar name={c.name ?? c.phones[0]} size={32} />
                      <b>{c.name ?? t('common.unknownCustomer')}</b>
                      {c.pinned === true && <Icon name="star" size={13} />}
                    </div>
                  </td>
                  <td className="muted">{c.phones[0] ?? ''}</td>
                  <td className="muted">{c.emails[0] ?? ''}</td>
                  <td className="muted">{relativeTime(c.lastContactAt, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
