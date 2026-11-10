import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider.js';
import { useI18n, type Locale } from '../i18n/i18n.js';
import { RingingPopup } from '../components/RingingPopup.js';
import { Icon, type IconName } from '../components/Icon.js';
import { Avatar } from '../components/Avatar.js';

const NAV: { to: string; icon: IconName; key: string; end?: boolean }[] = [
  { to: '/', icon: 'calls', key: 'nav.calls', end: true },
  { to: '/search', icon: 'search', key: 'nav.search' },
  { to: '/customers', icon: 'customers', key: 'nav.customers' },
  { to: '/tickets', icon: 'tickets', key: 'nav.tickets' },
  { to: '/admin', icon: 'users', key: 'nav.admin' },
  { to: '/dids', icon: 'phone', key: 'nav.dids' },
  { to: '/share', icon: 'key', key: 'nav.share' },
];

export function AppShell() {
  const { profile, signOut, companies, activeCompanyId, setActiveCompany } = useAuth();
  const { t, locale, setLocale } = useI18n();
  const other: Locale = locale === 'he' ? 'en' : 'he';
  const activeCompany = companies.find((c) => c.id === activeCompanyId);

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
          {/* Company switcher — the active company scopes every screen. A plain
              label when there is only one, a dropdown to switch when several. */}
          {companies.length > 1 ? (
            <label className="company-switch">
              <Icon name="customers" size={15} />
              <select value={activeCompanyId ?? ''} onChange={(e) => setActiveCompany(e.target.value)}>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name ?? c.id}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            activeCompany !== undefined && (
              <span className="company-current">{activeCompany.name ?? activeCompany.id}</span>
            )
          )}
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
