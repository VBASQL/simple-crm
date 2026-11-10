import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthProvider.js';
import { useServices } from '../services/ServicesContext.js';
import { useI18n } from '../i18n/i18n.js';
import { Avatar } from '../components/Avatar.js';
import { Icon } from '../components/Icon.js';
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
    if (companyId === undefined) return;
    const self = target === profile?.email;
    if (!window.confirm(self ? t('admin.confirmRemoveSelf') : t('admin.confirmRemove'))) return;
    try {
      // Remove from THIS company only; the user keeps access to their others.
      await services.removeUser(target, companyId);
    } catch {
      setError(t('admin.writeFailed'));
    }
  }

  return (
    <section>
      <div className="page-head">
        <h1>{t('admin.title')}</h1>
      </div>

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
        <div className="table-wrap">
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
                    <div className="cell-main">
                      <Avatar name={u.email} size={28} />
                      <span>{u.email}</span>
                      {u.email === profile?.email && <span className="muted">{t('admin.you')}</span>}
                    </div>
                  </td>
                  <td style={{ textAlign: 'end' }}>
                    <button type="button" className="btn btn--sm" onClick={() => void onRemove(u.email)}>
                      <Icon name="trash" size={15} />
                      {t('admin.remove')}
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
