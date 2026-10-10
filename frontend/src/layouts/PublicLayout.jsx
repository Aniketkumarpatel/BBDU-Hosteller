import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import LanguageToggle from '../components/common/LanguageToggle.jsx';
import BrandLogo from '../components/common/BrandLogo.jsx';
import Icon from '../components/jobs/icons.jsx';

/**
 * Public shell (DEC-033): the same look as the signed-in screens. A slim header with the
 * logo, the language switch and one button, then the page, then a quiet footer.
 * On a phone the sign-in or open-app button is left to the page itself (the hero has it), so the bar never gets crowded.
 */
export default function PublicLayout() {
  const { isAuthenticated, getDashboardPath } = useAuth();
  const { t } = useLanguage();

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/95 backdrop-blur-xs">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2.5">
          <Link to="/" className="flex min-w-0 items-center" aria-label="BBDU Hosteller">
            <BrandLogo />
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <LanguageToggle />
            {isAuthenticated ? (
              <Link
                to={getDashboardPath()}
                aria-label={t('nav.openApp')}
                className="hidden h-10 items-center justify-center gap-2 rounded-full bg-brand-600 px-5 text-sm font-bold text-white transition hover:bg-brand-700 active:scale-95 sm:flex"
              >
                {t('nav.openApp')}
                <Icon name="chevronRight" className="h-5 w-5" strokeWidth={2.5} />
              </Link>
            ) : (
              <Link
                to="/login"
                className="hidden h-10 items-center rounded-full bg-brand-600 px-5 text-sm font-bold text-white transition hover:bg-brand-700 active:scale-95 sm:flex"
              >
                {t('nav.signIn')}
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 bg-white px-4 py-5 text-center text-sm text-slate-500">
        &copy; {new Date().getFullYear()} BBDU Hosteller. {t('public.footer')}
      </footer>
    </div>
  );
}
