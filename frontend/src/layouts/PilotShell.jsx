import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import LanguageToggle from '../components/common/LanguageToggle.jsx';
import PilotNotificationBell from '../components/common/PilotNotificationBell.jsx';

/**
 * Shared page shell for the pilot screens (DEC-026, DEC-029): one short header with the
 * language switch, notifications and account menu always in the same place. Roles with
 * more than one destination pass `tabs`; a single-destination role (the technician)
 * passes none and gets no menu bar to get lost in.
 *
 * @param {{ homePath: string, tabs?: Array<{ to: string, labelKey: string }>, width?: string }} props
 */
export default function PilotShell({ homePath, tabs = [], width = 'max-w-2xl' }) {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const close = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
    };
  }, [menuOpen]);

  const handleSignOut = async () => {
    setMenuOpen(false);
    await logout();
    navigate('/login', { replace: true });
  };

  const initial = (user?.name || '?').trim().charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-xs">
        <div className={`mx-auto flex h-16 ${width} items-center justify-between gap-2 px-4`}>
          <Link to={homePath} className="flex items-center gap-2" aria-label={t('app.name')}>
            <img src="/favicon.svg" alt="" className="h-8 w-8" />
            <span className="hidden text-base font-bold text-brand-700 sm:inline">{t('app.name')}</span>
          </Link>

          <div className="flex items-center gap-2">
            <LanguageToggle />
            <PilotNotificationBell />

            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label={t('menu.account')}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 text-base font-bold text-white"
              >
                {initial}
              </button>

              {menuOpen && (
                <div role="menu" className="absolute right-0 mt-2 w-60 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                  <div className="border-b border-slate-100 px-3 py-2">
                    <p className="truncate text-base font-semibold text-slate-900">{user?.name}</p>
                    <p className="truncate text-sm text-slate-500">{user?.email}</p>
                  </div>
                  <Link
                    to="/change-password"
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                    className="mt-1 block rounded-xl px-3 py-3 text-base font-medium text-slate-700 hover:bg-slate-50"
                  >
                    {t('menu.changePassword')}
                  </Link>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleSignOut}
                    className="block w-full rounded-xl px-3 py-3 text-left text-base font-medium text-rose-700 hover:bg-rose-50"
                  >
                    {t('menu.signOut')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {tabs.length > 0 && (
          <nav aria-label="Main" className={`mx-auto flex ${width} gap-1 px-4`}>
            {tabs.map((tab) => (
              <NavLink
                key={tab.to}
                to={tab.to}
                className={({ isActive }) =>
                  `flex h-12 flex-1 items-center justify-center border-b-4 text-base font-bold transition ${
                    isActive ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`
                }
              >
                {t(tab.labelKey)}
              </NavLink>
            ))}
          </nav>
        )}
      </header>

      <main className={`mx-auto w-full ${width} px-4 py-5`}>
        <Outlet />
      </main>
    </div>
  );
}
