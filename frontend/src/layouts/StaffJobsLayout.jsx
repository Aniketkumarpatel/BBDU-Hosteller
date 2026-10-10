import { useEffect, useRef, useState } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import LanguageToggle from '../components/common/LanguageToggle.jsx';
import NotificationBell from '../components/common/NotificationBell.jsx';

/**
 * Shell for the technician screens (DEC-026). One short header and nothing else:
 * there is a single destination, "My jobs", so there is no menu bar to get lost in.
 * Language switch, notifications and the account menu are always in the same place.
 */
export default function StaffJobsLayout() {
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
        <div className="mx-auto flex h-16 max-w-2xl items-center justify-between gap-2 px-4">
          <Link to="/staff/jobs" className="flex items-center gap-2" aria-label={t('jobs.title')}>
            <img src="/favicon.svg" alt="" className="h-8 w-8" />
            <span className="hidden text-base font-bold text-indigo-700 sm:inline">{t('app.name')}</span>
          </Link>

          <div className="flex items-center gap-2">
            <LanguageToggle />
            <NotificationBell />

            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label={t('menu.account')}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 text-base font-bold text-white"
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
      </header>

      <main className="mx-auto w-full max-w-2xl px-4 py-5">
        <Outlet />
      </main>
    </div>
  );
}
