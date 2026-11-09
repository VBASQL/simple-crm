import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider.js';
import { useI18n } from '../i18n/i18n.js';

export function SignIn() {
  const { signIn } = useAuth();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function onClick() {
    setBusy(true);
    setFailed(false);
    try {
      await signIn();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="signin">
      <div className="card signin__form">
        <h1>{t('auth.title')}</h1>
        <p className="muted">{t('auth.subtitle')}</p>
        {failed && <p className="error">{t('auth.error')}</p>}
        <button type="button" className="btn btn--primary" onClick={() => void onClick()} disabled={busy}>
          {busy ? t('auth.signingIn') : t('auth.google')}
        </button>
      </div>
    </div>
  );
}
