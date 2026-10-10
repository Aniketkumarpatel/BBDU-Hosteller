import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import complaintService from '../../services/complaintService.js';
import { changeTechnician, giveToTechnician } from '../../services/problemActionService.js';
import ProblemCard from '../../components/problems/ProblemCard.jsx';
import AssignSheet from '../../components/problems/AssignSheet.jsx';
import Icon from '../../components/jobs/icons.jsx';
import {
  DONE_LIST_LIMIT,
  WARDEN_FILTERS,
  canGiveToTechnician,
  countAttention,
  countOpenByTechnician,
  countProblems,
  getDefaultFilter,
  groupProblems,
  needsTriage,
  rankTechnicians,
} from '../../utils/problemPresentation.js';

const REFRESH_MS = 60000;

// Tiles that need the Warden are coloured; the rest are calm
const TILE_STYLE = {
  assign: { on: 'border-orange-500 bg-orange-50', num: 'text-orange-700', hot: true },
  redo: { on: 'border-orange-500 bg-orange-50', num: 'text-orange-700', hot: true },
  late: { on: 'border-orange-500 bg-orange-50', num: 'text-orange-700', hot: true },
  with: { on: 'border-blue-500 bg-blue-50', num: 'text-blue-700', hot: false },
  waiting: { on: 'border-violet-500 bg-violet-50', num: 'text-violet-700', hot: false },
  done: { on: 'border-green-500 bg-green-50', num: 'text-green-700', hot: false },
};

/**
 * The Warden's home (DEC-029): what needs me, in order. Six big numbers act as filters,
 * the list below shows the chosen one. It opens on the first filter that needs the
 * Warden, and refreshes itself.
 */
export default function WardenProblemsPage() {
  const { user } = useAuth();
  const { t } = useLanguage();

  const [problems, setProblems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState('');
  const [toast, setToast] = useState('');
  const [updatedAt, setUpdatedAt] = useState(null);
  const [filter, setFilter] = useState(null);
  const [sheet, setSheet] = useState(null); // { id, mode }
  const [staff, setStaff] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [sheetError, setSheetError] = useState('');
  const toastTimer = useRef(null);

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    try {
      const res = await complaintService.listComplaints();
      if (res.success && Array.isArray(res.data)) {
        setProblems(res.data);
        setUpdatedAt(new Date());
        setErrorKey('');
      } else {
        throw new Error(res.message || 'load failed');
      }
    } catch {
      // A failed quiet refresh keeps the old list on screen instead of replacing it with an error
      if (!quiet) setErrorKey('error.load');
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') load({ quiet: true });
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const showToast = (message) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 5000);
  };

  const groups = useMemo(() => groupProblems(problems), [problems]);
  const counts = useMemo(() => countProblems(groups), [groups]);
  const attention = countAttention(counts);
  const active = filter ?? getDefaultFilter(counts);
  const openCounts = useMemo(() => countOpenByTechnician(problems), [problems]);

  const sheetProblem = sheet ? problems.find((p) => p._id === sheet.id) : null;
  const technicians = useMemo(
    () => (sheetProblem ? rankTechnicians(staff, sheetProblem, openCounts) : []),
    [staff, sheetProblem, openCounts]
  );

  const openSheet = async (problem) => {
    setSheetError('');
    setSheet({ id: problem._id, mode: canGiveToTechnician(problem) ? 'give' : 'change' });
    setStaff([]);
    try {
      const res = await complaintService.getEligibleAssignees(problem._id);
      if (res.success && Array.isArray(res.data)) setStaff(res.data);
    } catch {
      setSheetError(t('error.load'));
    }
  };

  const closeSheet = useCallback(() => {
    setSheet(null);
    setSheetError('');
  }, []);

  const handleSubmit = async ({ technician, priority, reason }) => {
    if (!sheetProblem) return;
    setSubmitting(true);
    setSheetError('');
    try {
      if (sheet.mode === 'give') {
        await giveToTechnician(sheetProblem, { technician, priority });
        showToast(t('toast.assigned', { name: technician.name }));
      } else {
        await changeTechnician(sheetProblem, { technician, reason });
        showToast(t('toast.reassigned', { name: technician.name }));
      }
      closeSheet();
      await load({ quiet: true });
    } catch (err) {
      setSheetError(err?.response?.data?.message || (err.partial ? t('error.assignPartial') : t('error.assign')));
      if (err.partial) await load({ quiet: true });
    } finally {
      setSubmitting(false);
    }
  };

  const list = groups[active] || [];
  const shown = active === 'done' ? list.slice(0, DONE_LIST_LIMIT) : list;
  const firstName = (user?.name || '').trim().split(/\s+/)[0];
  const summary =
    attention === 0 ? t('warden.summary.none') : attention === 1 ? t('warden.summary.one') : t('warden.summary.many', { n: attention });
  const totalAll = WARDEN_FILTERS.reduce((sum, key) => sum + counts[key], 0);

  return (
    <div className="space-y-5">
      <section>
        <p className="text-base text-slate-500">{t('jobs.hello', { name: firstName })}</p>
        <h1 className="mt-0.5 text-3xl font-bold tracking-tight text-slate-900">{t('warden.title')}</h1>
        {!loading && !errorKey && (
          <p className={`mt-1 text-lg font-medium ${attention > 0 ? 'text-orange-700' : 'text-slate-700'}`}>{summary}</p>
        )}
      </section>

      {toast && (
        <div role="status" className="flex items-start gap-3 rounded-2xl bg-emerald-600 p-4 text-lg font-semibold text-white shadow-md">
          <Icon name="check" className="mt-0.5 h-6 w-6 shrink-0" strokeWidth={3} />
          <span>{toast}</span>
        </div>
      )}

      {loading ? (
        <div className="space-y-4" aria-busy="true" aria-label={t('common.loading')}>
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-200/70" />
            ))}
          </div>
          <div className="h-44 animate-pulse rounded-2xl bg-slate-200/70" />
        </div>
      ) : errorKey ? (
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-center">
          <Icon name="alert" className="mx-auto h-8 w-8 text-rose-600" />
          <p className="mt-2 text-lg font-semibold text-rose-800">{t(errorKey)}</p>
          <button
            type="button"
            onClick={() => load()}
            className="mt-4 h-12 rounded-xl bg-rose-600 px-6 text-base font-bold text-white hover:bg-rose-700"
          >
            {t('common.retry')}
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3" role="tablist" aria-label={t('warden.title')}>
            {WARDEN_FILTERS.map((key) => {
              const style = TILE_STYLE[key];
              const selected = active === key;
              const glow = style.hot && counts[key] > 0;
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setFilter(key)}
                  className={`flex min-h-24 flex-col items-center justify-center rounded-2xl border-2 px-1 py-2 text-center transition ${
                    selected ? `${style.on} shadow-sm` : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <span className={`text-3xl font-bold leading-none ${glow || selected ? style.num : 'text-slate-700'}`}>{counts[key]}</span>
                  <span className={`mt-1.5 text-sm font-semibold leading-tight ${selected ? 'text-slate-900' : 'text-slate-600'}`}>
                    {t(`wfilter.${key}`)}
                  </span>
                </button>
              );
            })}
          </div>

          {shown.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
              <Icon name="inbox" className="mx-auto h-10 w-10 text-slate-400" />
              <p className="mt-3 text-xl font-bold text-slate-800">{totalAll === 0 ? t('warden.empty.all') : t('warden.empty.filter')}</p>
              {totalAll === 0 && <p className="mt-1 text-base text-slate-500">{t('warden.empty.body')}</p>}
            </div>
          ) : (
            <div className="space-y-4">
              {shown.map((problem) => (
                <ProblemCard key={problem._id} problem={problem} onGive={openSheet} />
              ))}
              {active === 'done' && list.length > DONE_LIST_LIMIT && (
                <p className="text-center text-sm text-slate-400">{t('warden.showing', { n: DONE_LIST_LIMIT })}</p>
              )}
            </div>
          )}
        </>
      )}

      {!loading && updatedAt && (
        <div className="flex items-center justify-between pt-2 text-sm text-slate-400">
          <span>{t('jobs.updated', { time: updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })}</span>
          <button
            type="button"
            onClick={() => load({ quiet: true })}
            className="flex h-10 items-center gap-1.5 rounded-lg px-3 font-semibold text-slate-600 hover:bg-slate-100"
          >
            <Icon name="refresh" className="h-4 w-4" />
            {t('common.refresh')}
          </button>
        </div>
      )}

      <AssignSheet
        isOpen={Boolean(sheet && sheetProblem)}
        onClose={closeSheet}
        problem={sheetProblem}
        technicians={technicians}
        mode={sheet?.mode || 'give'}
        askUrgency={sheetProblem ? needsTriage(sheetProblem) : true}
        onSubmit={handleSubmit}
        submitting={submitting}
        error={sheetError}
      />
    </div>
  );
}

