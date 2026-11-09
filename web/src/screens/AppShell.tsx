import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider.js';
import { useI18n, type Locale } from '../i18n/i18n.js';
import { RingingPopup } from '../components/RingingPopup.js';

export function AppShell() {
  const { profile, signOut } = useAuth();
  const { t, locale, setLocale } = useI18n();

  const other: Locale = locale === 'he' ? 'en' : 'he';

  return (
    <div className="shell">
      <header className="shell__bar">
        <Link to="/" className="shell__brand">
          {t('app.name')}
        </Link>
        <nav className="shell__nav">
          <Link to="/">{t('nav.calls')}</Link>
          {profile !== null && <Link to="/admin">{t('nav.admin')}</Link>}
        </nav>
        <div className="shell__spacer" />
        <button type="button" className="btn btn--ghost" onClick={() => setLocale(other)}>
          {t(`locale.${other}`)}
        </button>
        {profile?.name !== undefined && <span className="muted">{profile.name}</span>}
        <button type="button" className="btn" onClick={() => void signOut()}>
          {t('nav.signOut')}
        </button>
      </header>

      <main className="shell__main">
        {profile === null ? <p className="muted">{t('app.noProfile')}</p> : <Outlet />}
      </main>

      <RingingPopup />
    </div>
  );
}
