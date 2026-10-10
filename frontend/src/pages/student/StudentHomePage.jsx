import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import complaintService from '../../services/complaintService.js';
import TrackerCard from '../../components/student/TrackerCard.jsx';
import Icon from '../../components/jobs/icons.jsx';
import CategoryArt from '../../components/student/CategoryArt.jsx';
import { REPORT_CATEGORIES, getStudentStage, isActive } from '../../utils/studentPresentation.js';

const REFRESH_MS = 60000;

const byNewest = (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0);

/**
 * Student home (DEC-031): one bold banner to report, a row of pictures to start a report
 * in one tap, then whatever is happening right now, tracked like an order.
 */
export default function StudentHomePage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [problems, setProblems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState('');

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    try {
      const res = await complaintService.getMyComplaints();
      const rows = Array.isArray(res?.data) ? res.data : res?.data?.complaints;
      if (res?.success && Array.isArray(rows)) {
        setProblems(rows);
        setErrorKey('');
      } else {
        throw new Error('load failed');
      }
    } catch {
      if (!quiet) setErrorKey('error.load');
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const timer = setInterval(() => document.visibilityState === 'visible' && load({ quiet: true }), REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  const active = useMemo(() => problems.filter(isActive).sort(byNewest), [problems]);
  const fixed = useMemo(() => problems.filter((p) => getStudentStage(p) === 'done').sort(byNewest).slice(0, 3), [problems]);
  const firstName = (user?.name || '').trim().split(/\s+/)[0];

  return (
    <div className="space-y-7 px-4 pt-4">
      <section>
        <p className="text-base text-slate-500">{t('jobs.hello', { name: firstName })}</p>
        <div className="relative mt-2 overflow-hidden rounded-3xl bg-linear-to-br from-brand-500 to-brand-700 p-5 text-white shadow-[0_12px_28px_-8px_rgba(200,42,65,0.55)]">
          <span className="absolute -bottom-12 -left-10 h-36 w-36 rounded-full bg-white/10" />
          <Icon name="tool" className="absolute -right-3 -top-2 h-32 w-32 text-white/15" strokeWidth={1.5} />
          <p className="text-sm font-semibold text-white/90">{t('student.banner.kicker')}</p>
          <p className="mt-1 max-w-[15rem] text-2xl font-bold leading-tight">{t('student.banner.title')}</p>
          <Link
            to="/student/report"
            className="mt-4 inline-flex h-12 items-center gap-2 rounded-2xl bg-white px-5 text-base font-bold text-brand-700 transition active:scale-95"
          >
            <Icon name="plus" className="h-5 w-5" strokeWidth={3} />
            {t('student.banner.cta')}
          </Link>
        </div>
      </section>

      <section aria-labelledby="cat-title">
        <h2 id="cat-title" className="text-xl font-bold text-slate-900">
          {t('student.categories')}
        </h2>
        <div className="-mx-4 mt-3 flex gap-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {REPORT_CATEGORIES.map((key) => (
            <Link key={key} to={`/student/report?category=${key}`} className="group flex w-20 shrink-0 flex-col items-center gap-2 text-center">
              <CategoryArt category={key} size="h-[4.5rem] w-[4.5rem]" iconSize="h-8 w-8" className="transition group-active:scale-95" />
              <span className="text-xs font-semibold leading-tight text-slate-800">{t(`category.${key}`)}</span>
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="now-title">
        <div className="flex items-center justify-between">
          <h2 id="now-title" className="text-xl font-bold text-slate-900">
            {t('student.now')}
          </h2>
          {problems.length > 0 && (
            <Link to="/student/problems" className="text-sm font-bold text-brand-600">
              {t('student.seeAll')}
            </Link>
          )}
        </div>

        <div className="mt-3 space-y-3">
          {loading ? (
            <div className="space-y-3" aria-busy="true" aria-label={t('common.loading')}>
              <div className="h-40 animate-pulse rounded-3xl bg-slate-100" />
            </div>
          ) : errorKey ? (
            <div role="alert" className="rounded-3xl border border-brand-200 bg-brand-50 p-5 text-center">
              <p className="text-base font-semibold text-brand-800">{t(errorKey)}</p>
              <button type="button" onClick={() => load()} className="mt-3 h-12 rounded-2xl bg-brand-600 px-6 text-base font-bold text-white">
                {t('common.retry')}
              </button>
            </div>
          ) : active.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-7 text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-50 text-green-600">
                <Icon name="check" className="h-7 w-7" strokeWidth={3} />
              </span>
              <p className="mt-3 text-lg font-bold text-slate-800">{t('student.none.title')}</p>
              <p className="mt-1 text-sm text-slate-500">{t('student.none.body')}</p>
            </div>
          ) : (
            active.map((problem) => <TrackerCard key={problem._id} problem={problem} />)
          )}
        </div>
      </section>

      {fixed.length > 0 && (
        <section aria-labelledby="fixed-title">
          <h2 id="fixed-title" className="text-xl font-bold text-slate-900">
            {t('student.recent')}
          </h2>
          <div className="mt-3 space-y-3">
            {fixed.map((problem) => (
              <TrackerCard key={problem._id} problem={problem} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
