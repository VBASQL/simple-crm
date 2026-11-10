import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider.js';
import { useI18n, type Locale } from '../i18n/i18n.js';
import { RingingPopup } from '../components/RingingPopup.js';
import { Icon, type IconName } from '../components/Icon.js';
import { Avatar } from '../components/Avatar.js';

const NAV: { to: string; icon: IconName; key: string; end?: boolean }[] = [
  { to: '/', icon: 'calls', key: 'nav.calls', end: true },
  { to: '/customers', icon: 'customers', key: 'nav.customers' },
  { to: '/tickets', icon: 'tickets', key: 'nav.tickets' },
  { to: '/admin', icon: 'users', key: 'nav.admin' },
  { to: '/dids', icon: 'phone', key: 'nav.dids' },
  { to: '/share', icon: 'key', key: 'nav.share' },
];

export function AppShell() {
  const { profile, signOut } = useAuth();
  const { t, locale, setLocale } = useI18n();
  const other: Locale = locale === 'he' ? 'en' : 'he';

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar__brand">
          <span className="sidebar__logo">C</span>
          <span>{t('app.name')}</span>
        </div>
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `navlink${isActive ? ' is-active' : ''}`}
          >
            <Icon name={item.icon} />
            <span>{t(item.key)}</span>
          </NavLink>
        ))}
        <div className="sidebar__spacer" />
        <div className="sidebar__user">
          <Avatar name={profile?.name ?? profile?.email} size={34} />
          <div className="sidebar__user-meta">
            <b>{profile?.name ?? t('app.name')}</b>
            <span className="muted">{profile?.email}</span>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar__spacer" />
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => setLocale(other)}>
            {t(`locale.${other}`)}
          </button>
          <button type="button" className="btn btn--sm" onClick={() => void signOut()}>
            <Icon name="logout" size={16} />
            {t('nav.signOut')}
          </button>
        </header>
        <div className="content">{profile === null ? <p className="muted">{t('app.noProfile')}</p> : <Outlet />}</div>
      </div>

      <RingingPopup />
    </div>
  );
}
