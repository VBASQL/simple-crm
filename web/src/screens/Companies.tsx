import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider.js';
import { useServices } from '../services/ServicesContext.js';
import { useI18n } from '../i18n/i18n.js';
import { Icon } from '../components/Icon.js';

/**
 * Companies hub: the one place to see every company the operator works in,
 * switch the active one, jump to its numbers/settings, and create a new one.
 * A company is essentially its set of DIDs, so numbers live one click away.
 */
export function Companies() {
  const { companies, activeCompanyId, setActiveCompany, refresh } = useAuth();
  const services = useServices();
  const { t } = useI18n();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    const clean = name.trim();
    if (clean.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const created = await services.createCompany(clean);
      await refresh(); // pull the new company into the switcher
      setActiveCompany(created.id);
      setName('');
      // Land on its settings so the operator can finish configuring it.
      navigate('/settings');
    } catch {
      setError(t('companies.createFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <div className="page-head">
        <h1>{t('companies.title')}</h1>
      </div>
      <p className="muted" style={{ marginTop: '-0.5rem', marginBottom: '1rem' }}>{t('companies.subtitle')}</p>

      <form className="card admin__form" onSubmit={(e) => void onCreate(e)}>
        <input
          type="text"
          placeholder={t('companies.namePh')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <button type="submit" className="btn btn--primary" disabled={busy}>
          <Icon name="plus" size={16} />
          {busy ? t('companies.creating') : t('companies.create')}
        </button>
      </form>
      {error !== null && <p className="error">{error}</p>}

      <div className="card card--pad" style={{ marginTop: '1rem' }}>
        <ul className="list">
          {companies.map((c) => {
            const active = c.id === activeCompanyId;
            return (
              <li key={c.id}>
                <Icon name="customers" size={18} />
                <span className="grow">
                  <b>{c.name ?? c.id}</b>
                  {active && <span className="chip" style={{ marginInlineStart: '0.5rem' }}>{t('companies.active')}</span>}
                </span>
                {active ? (
                  <button type="button" className="btn btn--sm" onClick={() => navigate('/settings')}>
                    <Icon name="settings" size={14} />
                    {t('companies.manage')}
                  </button>
                ) : (
                  <button type="button" className="btn btn--sm" onClick={() => setActiveCompany(c.id)}>
                    {t('companies.switchTo')}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
