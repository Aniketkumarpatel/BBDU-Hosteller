import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useLanguage } from '../i18n/LanguageContext.jsx';
import ApiStatus from '../components/ApiStatus.jsx';
import Icon from '../components/jobs/icons.jsx';

const FEATURES = [
  { key: 'f1', icon: 'bolt', art: 'from-amber-300 to-orange-500' },
  { key: 'f2', icon: 'list', art: 'from-sky-400 to-blue-600' },
  { key: 'f3', icon: 'check', art: 'from-emerald-400 to-green-600' },
];

/**
 * Landing page (DEC-033): the student Home banner, full width, then three short promises.
 * The wording matches what the pilot really does, so there is no claim about automatic
 * escalation (it is switched off in pilot mode, DEC-020).
 */
export default function LandingPage() {
  const { isAuthenticated, getDashboardPath } = useAuth();
  const { t } = useLanguage();

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 pb-12 pt-4 sm:pt-8">
      <section className="relative overflow-hidden rounded-3xl bg-linear-to-br from-brand-500 to-brand-700 px-6 py-10 text-white shadow-[0_12px_28px_-8px_rgba(200,42,65,0.55)] sm:px-12 sm:py-16">
        <span className="absolute -bottom-16 -left-12 h-48 w-48 rounded-full bg-white/10" />
        <Icon name="tool" className="absolute -right-6 -top-4 h-56 w-56 text-white/15 sm:h-72 sm:w-72" strokeWidth={1.3} />
        <div className="relative">
          <p className="text-base font-semibold text-white/90">{t('student.banner.kicker')}</p>
          <h1 className="mt-1 max-w-md text-4xl font-extrabold leading-tight sm:text-5xl">{t('student.banner.title')}</h1>
          <p className="mt-4 max-w-md text-lg text-white/90">{t('landing.sub')}</p>
          <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link
              to={isAuthenticated ? getDashboardPath() : '/login'}
              className="inline-flex h-14 items-center gap-2 rounded-2xl bg-white px-7 text-lg font-bold text-brand-700 transition active:scale-95"
            >
              {isAuthenticated ? t('nav.openApp') : t('landing.cta')}
              <Icon name="chevronRight" className="h-5 w-5" strokeWidth={3} />
            </Link>
            {!isAuthenticated && (
              <p className="text-sm text-white/90">
                {t('login.noAccount')}{' '}
                <Link to="/register" className="font-bold underline underline-offset-2">
                  {t('login.register')}
                </Link>
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.key} className="flex items-start gap-4 rounded-3xl bg-white p-5 shadow-[0_4px_14px_-4px_rgba(15,23,42,0.18)] ring-1 ring-black/5 sm:block">
            <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br text-white shadow-[0_6px_14px_-6px_rgba(15,23,42,0.45)] ${f.art}`}>
              <Icon name={f.icon} className="h-7 w-7" strokeWidth={1.9} />
            </span>
            <div className="min-w-0 sm:mt-4">
              <h2 className="text-lg font-bold leading-snug text-slate-900">{t(`landing.${f.key}.title`)}</h2>
              <p className="mt-1 text-base text-slate-600">{t(`landing.${f.key}.text`)}</p>
            </div>
          </div>
        ))}
      </section>

      {import.meta.env.DEV && (
        <div className="flex justify-center">
          <ApiStatus />
        </div>
      )}
    </div>
  );
}
