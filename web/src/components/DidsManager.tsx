import { useEffect, useState, type FormEvent } from 'react';
import { useServices } from '../services/ServicesContext.js';
import { useI18n } from '../i18n/i18n.js';
import { Icon } from './Icon.js';
import type { Did } from '../types.js';

/**
 * Manage a company's DIDs (its dialled numbers). A company is essentially its
 * set of numbers, so this lives inside the company settings. Writes go through
 * the manageDid callable (E.164 normalisation server-side).
 */
export function DidsManager({ companyId }: { companyId: string }) {
  const services = useServices();
  const { t } = useI18n();

  const [dids, setDids] = useState<Did[]>([]);
  const [number, setNumber] = useState('');
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => services.subscribeDids(companyId, setDids), [services, companyId]);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    if (number.trim().length === 0) return;
    setBusy(true);
    setError(null);
    try {
      await services.addDid(number.trim(), companyId, label.trim() || undefined);
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
      await services.removeDid(num, companyId);
    } catch {
      setError(t('dids.failed'));
    }
  }

  return (
    <div>
      <h2>{t('dids.title')}</h2>
      <p className="muted" style={{ marginTop: '-0.3rem', marginBottom: '0.9rem' }}>{t('dids.subtitle')}</p>

      <form className="admin__form" style={{ padding: 0 }} onSubmit={(e) => void onAdd(e)}>
        <input
          type="text"
          inputMode="tel"
          placeholder={t('dids.numberPh')}
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          required
          style={{ minWidth: '170px' }}
        />
        <input
          type="text"
          placeholder={t('dids.labelPh')}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          style={{ minWidth: '150px' }}
        />
        <button type="submit" className="btn btn--primary" disabled={busy}>
          <Icon name="plus" size={16} />
          {busy ? t('dids.adding') : t('dids.add')}
        </button>
      </form>
      {error !== null && <p className="error">{error}</p>}

      {dids.length === 0 ? (
        <p className="muted" style={{ marginTop: '0.8rem' }}>{t('dids.empty')}</p>
      ) : (
        <ul className="list" style={{ marginTop: '0.6rem' }}>
          {dids.map((d) => (
            <li key={d.number}>
              <Icon name="phone" size={15} />
              <span className="grow mono">{d.number}</span>
              <span className="muted">{d.label ?? ''}</span>
              <button type="button" className="btn btn--sm" onClick={() => void onRemove(d.number)}>
                <Icon name="trash" size={14} />
                {t('dids.remove')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
