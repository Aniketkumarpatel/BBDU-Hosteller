import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import complaintService from '../../services/complaintService.js';
import TrackerCard from '../../components/student/TrackerCard.jsx';
import Icon from '../../components/jobs/icons.jsx';
import { getStudentStage, isActive } from '../../utils/studentPresentation.js';

const FILTERS = ['active', 'fixed', 'all'];
const byNewest = (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0);

/** All of the student's problems, filtered Active, Fixed or All, as tracker cards. */
export default function StudentProblemsPage() {
  const { t } = useLanguage();
  const [problems, setProblems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState('');
  const [filter, setFilter] = useState('active');

  const load = useCallback(async () => {
    setLoading(true);
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
      setErrorKey('error.load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(
    () => ({
      active: problems.filter(isActive).length,
      fixed: problems.filter((p) => getStudentStage(p) === 'done').length,
      all: problems.filter((p) => getStudentStage(p) !== null).length,
    }),
    [problems]
  );

  const shown = useMemo(() => {
    const visible = problems.filter((p) => getStudentStage(p) !== null);
    const rows = filter === 'active' ? visible.filter(isActive) : filter === 'fixed' ? visible.filter((p) => getStudentStage(p) === 'done') : visible;
    return [...rows].sort(byNewest);
  }, [problems, filter]);

  return (
    <div className="space-y-5 px-4 pt-4">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">{t('sproblems.title')}</h1>

      <div className="flex gap-2.5" role="tablist" aria-label={t('sproblems.title')}>
        {FILTERS.map((key) => {
          const on = filter === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setFilter(key)}
              className={`h-11 rounded-full px-4 text-base font-bold transition ${
                on ? 'bg-brand-600 text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-700 hover:border-slate-300'
              }`}
            >
              {t(`sproblems.${key}`)} <span className={on ? 'text-white/80' : 'text-slate-400'}>{counts[key]}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="space-y-3" aria-busy="true" aria-label={t('common.loading')}>
          {[0, 1].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-3xl bg-slate-100" />
          ))}
        </div>
      ) : errorKey ? (
        <div role="alert" className="rounded-3xl border border-brand-200 bg-brand-50 p-5 text-center">
          <p className="text-base font-semibold text-brand-800">{t(errorKey)}</p>
          <button type="button" onClick={load} className="mt-3 h-12 rounded-2xl bg-brand-600 px-6 text-base font-bold text-white">
            {t('common.retry')}
          </button>
        </div>
      ) : shown.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
          <Icon name="inbox" className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 text-lg font-bold text-slate-700">{t('sproblems.empty')}</p>
          <Link to="/student/report" className="mt-4 inline-flex h-12 items-center rounded-2xl bg-brand-600 px-6 text-base font-bold text-white">
            {t('student.banner.cta')}
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map((problem) => (
            <TrackerCard key={problem._id} problem={problem} />
          ))}
        </div>
      )}
    </div>
  );
}
