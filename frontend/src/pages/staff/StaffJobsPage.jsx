import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import complaintService from '../../services/complaintService.js';
import { performJobAction, TOAST_KEY } from '../../services/jobActionService.js';
import JobCard from '../../components/jobs/JobCard.jsx';
import Icon from '../../components/jobs/icons.jsx';
import { STAGE_STYLE } from '../../components/jobs/stageStyle.js';
import { countActionable, groupJobs } from '../../utils/jobPresentation.js';

const REFRESH_MS = 60000;
// Sections that need no action start folded away so the list stays short
const COLLAPSED_BY_DEFAULT = ['waiting', 'done'];

/**
 * "My jobs": the technician's home screen (DEC-026). Sections follow the order the
 * work happens in, most urgent action first. It refreshes itself so nobody has to.
 */
export default function StaffJobsPage() {
  const { user } = useAuth();
  const { t } = useLanguage();

  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [open, setOpen] = useState({});
  const toastTimer = useRef(null);

  const myId = user?._id || user?.id;

  const load = useCallback(
    async ({ quiet = false } = {}) => {
      if (!quiet) setLoading(true);
      try {
        const res = await complaintService.listComplaints();
        if (res.success && Array.isArray(res.data)) {
          setJobs(res.data.filter((c) => (c.assignedTo?._id || c.assignedTo) === myId));
          setUpdatedAt(new Date());
          setError('');
        } else {
          throw new Error(res.message || 'load failed');
        }
      } catch {
        // A failed quiet refresh keeps the old list on screen instead of replacing it with an error
        if (!quiet) setError('error.load');
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [myId]
  );

  useEffect(() => {
    load();
  }, [load]);

  // Keep the list fresh while the screen is visible
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

  const handleAction = async (action, job) => {
    setBusyId(job._id);
    try {
      await performJobAction(action, job._id);
      showToast(t(TOAST_KEY[action]));
      await load({ quiet: true });
    } catch (err) {
      showToast(err?.response?.data?.message || t('error.action'));
    } finally {
      setBusyId(null);
    }
  };

  const sections = groupJobs(jobs);
  const todo = countActionable(jobs);
  const firstName = (user?.name || '').trim().split(/\s+/)[0];

  const isOpen = (stage) => (stage in open ? open[stage] : !COLLAPSED_BY_DEFAULT.includes(stage));
  const toggle = (stage) => setOpen((current) => ({ ...current, [stage]: !isOpen(stage) }));

  const summary =
    todo === 0 ? t('jobs.summary.none') : todo === 1 ? t('jobs.summary.one') : t('jobs.summary.many', { n: todo });

  return (
    <div className="space-y-5">
      <section>
        <p className="text-base text-slate-500">{t('jobs.hello', { name: firstName })}</p>
        <h1 className="mt-0.5 text-3xl font-bold tracking-tight text-slate-900">{t('jobs.title')}</h1>
        {!loading && !error && <p className="mt-1 text-lg font-medium text-slate-700">{summary}</p>}
      </section>

      {toast && (
        <div role="status" className="flex items-start gap-3 rounded-2xl bg-emerald-600 p-4 text-lg font-semibold text-white shadow-md">
          <Icon name="check" className="mt-0.5 h-6 w-6 shrink-0" strokeWidth={3} />
          <span>{toast}</span>
        </div>
      )}

      {loading ? (
        <div className="space-y-4" aria-busy="true" aria-label={t('common.loading')}>
          {[0, 1].map((i) => (
            <div key={i} className="h-44 animate-pulse rounded-2xl bg-slate-200/70" />
          ))}
        </div>
      ) : error ? (
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-center">
          <Icon name="alert" className="mx-auto h-8 w-8 text-rose-600" />
          <p className="mt-2 text-lg font-semibold text-rose-800">{t(error)}</p>
          <button
            type="button"
            onClick={() => load()}
            className="mt-4 h-12 rounded-xl bg-rose-600 px-6 text-base font-bold text-white hover:bg-rose-700"
          >
            {t('common.retry')}
          </button>
        </div>
      ) : sections.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <Icon name="inbox" className="mx-auto h-10 w-10 text-slate-400" />
          <p className="mt-3 text-xl font-bold text-slate-800">{t('jobs.empty.title')}</p>
          <p className="mt-1 text-base text-slate-500">{t('jobs.empty.body')}</p>
        </div>
      ) : (
        sections.map(({ stage, jobs: stageJobs }) => {
          const expanded = isOpen(stage);
          return (
            <section key={stage} aria-labelledby={`section-${stage}`}>
              <button
                type="button"
                onClick={() => toggle(stage)}
                aria-expanded={expanded}
                className="mb-3 flex w-full items-center justify-between rounded-xl py-1 text-left"
              >
                <span id={`section-${stage}`} className={`flex items-center gap-2 text-lg font-bold ${STAGE_STYLE[stage].text}`}>
                  <Icon name={STAGE_STYLE[stage].icon} className="h-5 w-5" />
                  {t(`section.${stage}`)}
                  <span className="rounded-full bg-white px-2.5 py-0.5 text-base font-bold text-slate-700 ring-1 ring-slate-200">
                    {stageJobs.length}
                  </span>
                </span>
                <Icon name="chevron" className={`h-5 w-5 text-slate-400 transition ${expanded ? 'rotate-180' : ''}`} />
              </button>

              {expanded && (
                <div className="space-y-4">
                  {stageJobs.map((job) => (
                    <JobCard key={job._id} job={job} busy={busyId === job._id} onAction={handleAction} />
                  ))}
                </div>
              )}
            </section>
          );
        })
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
    </div>
  );
}
