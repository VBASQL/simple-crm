import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthProvider.js';
import { useServices } from '../services/ServicesContext.js';
import { useI18n } from '../i18n/i18n.js';
import { Icon } from '../components/Icon.js';
import type { Did } from '../types.js';

export function Dids() {
  const { profile } = useAuth();
  const services = useServices();
  const { t } = useI18n();

  const [dids, setDids] = useState<Did[]>([]);
  const [number, setNumber] = useState('');
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const companyId = profile?.companyId;
  useEffect(() => {
    if (companyId === undefined) return;
    return services.subscribeDids(companyId, setDids);
  }, [services, companyId]);

  if (companyId === undefined) return <p className="muted">{t('common.loading')}</p>;

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    if (number.trim().length === 0) return;
    setBusy(true);
    setError(null);
    try {
      await services.addDid(number.trim(), label.trim() || undefined);
      setNumber('');
      setLabel('');
    } catch (err) {
      const code = (err as { code?: string }).code ?? '';
      if (code.includes('already-exists')) setError(t('dids.conflict'));
      else if (code.includes('invalid-argument')) setError(t('dids.invalid'));
      else setError(t('dids.failed'));
    } finally {
      setBusy(false);
    }
  }

  async function onRemove(num: string) {
    if (!window.confirm(t('dids.confirmRemove'))) return;
    try {
      await services.removeDid(num);
    } catch {
      setError(t('dids.failed'));
    }
  }

  return (
    <section>
      <div className="page-head">
        <h1>{t('dids.title')}</h1>
      </div>
      <p className="muted" style={{ marginTop: '-0.5rem', marginBottom: '1rem' }}>{t('dids.subtitle')}</p>

      <form className="card admin__form" onSubmit={(e) => void onAdd(e)}>
        <input
          type="text"
          inputMode="tel"
          placeholder={t('dids.numberPh')}
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          required
          style={{ minWidth: '180px' }}
        />
        <input
          type="text"
          placeholder={t('dids.labelPh')}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          style={{ minWidth: '160px' }}
        />
        <button type="submit" className="btn btn--primary" disabled={busy}>
          <Icon name="plus" size={16} />
          {busy ? t('dids.adding') : t('dids.add')}
        </button>
      </form>
      {error !== null && <p className="error">{error}</p>}

      {dids.length === 0 ? (
        <div className="card card--pad empty">
          <span className="empty__icon">
            <Icon name="phone" size={22} />
          </span>
          <p>{t('dids.empty')}</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t('dids.number')}</th>
                <th>{t('dids.label')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {dids.map((d) => (
                <tr key={d.number}>
                  <td className="mono">{d.number}</td>
                  <td className="muted">{d.label ?? ''}</td>
                  <td style={{ textAlign: 'end' }}>
                    <button type="button" className="btn btn--sm" onClick={() => void onRemove(d.number)}>
                      <Icon name="trash" size={15} />
                      {t('dids.remove')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
