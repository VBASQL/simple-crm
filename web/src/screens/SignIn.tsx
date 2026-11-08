import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthProvider.js';
import { useI18n } from '../i18n/i18n.js';

export function SignIn() {
  const { signIn } = useAuth();
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFailed(false);
    try {
      await signIn(email, password);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="signin">
      <form className="card signin__form" onSubmit={onSubmit}>
        <h1>{t('auth.title')}</h1>
        <label>
          {t('auth.email')}
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label>
          {t('auth.password')}
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {failed && <p className="error">{t('auth.error')}</p>}
        <button type="submit" className="btn btn--primary" disabled={busy}>
          {busy ? t('auth.signingIn') : t('auth.signIn')}
        </button>
      </form>
    </div>
  );
}
