import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthProvider.js';
import { useServices } from '../services/ServicesContext.js';
import { useI18n } from '../i18n/i18n.js';
import type { AllowlistEntry } from '../types.js';

export function AdminUsers() {
  const { profile } = useAuth();
  const services = useServices();
  const { t } = useI18n();

  const [entries, setEntries] = useState<AllowlistEntry[]>([]);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const companyId = profile?.companyId;

  useEffect(() => {
    if (companyId === undefined) return;
    return services.subscribeAllowlist(companyId, setEntries);
  }, [services, companyId]);

  if (companyId === undefined) {
    return <p className="muted">{t('common.loading')}</p>;
  }

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    const clean = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      setError(t('admin.invalidEmail'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await services.addUser(clean, companyId as string);
      setEmail('');
    } catch {
      setError(t('admin.writeFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function onRemove(target: string) {
    const self = target === profile?.email;
    if (!window.confirm(self ? t('admin.confirmRemoveSelf') : t('admin.confirmRemove'))) return;
    try {
      await services.removeUser(target);
    } catch {
      setError(t('admin.writeFailed'));
    }
  }

  return (
    <section>
      <h1>{t('admin.title')}</h1>

      <form className="card admin__form" onSubmit={(e) => void onAdd(e)}>
        <input
          type="email"
          placeholder={t('admin.email')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <button type="submit" className="btn btn--primary" disabled={busy}>
          {t('admin.add')}
        </button>
      </form>
      {error !== null && <p className="error">{error}</p>}

      {entries.length === 0 ? (
        <p className="muted">{t('admin.empty')}</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>{t('admin.email')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {entries.map((u) => (
              <tr key={u.email}>
                <td>
                  {u.email}
                  {u.email === profile?.email && <span className="muted"> {t('admin.you')}</span>}
                </td>
                <td style={{ textAlign: 'end' }}>
                  <button type="button" className="btn" onClick={() => void onRemove(u.email)}>
                    {t('admin.remove')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
