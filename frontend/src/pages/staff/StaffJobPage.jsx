import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import complaintService from '../../services/complaintService.js';
import { performJobAction, TOAST_KEY } from '../../services/jobActionService.js';
import StageChip from '../../components/jobs/StageChip.jsx';
import DueLine from '../../components/jobs/DueLine.jsx';
import ProgressSteps from '../../components/jobs/ProgressSteps.jsx';
import FinishSheet from '../../components/jobs/FinishSheet.jsx';
import Icon from '../../components/jobs/icons.jsx';
import { ACTION_STYLE, PRIORITY_STYLE } from '../../components/jobs/stageStyle.js';
import { getLocation, getNextAction, getProgressSteps, getStage } from '../../utils/jobPresentation.js';
import { describeBlock } from '../../utils/jobFormat.js';

/**
 * One job (DEC-026). The first screen answers four questions in order: where, what is
 * wrong, how soon, and what do I do now. Everything else sits under "More details".
 * The next-step button stays pinned to the bottom of the screen.
 */
export default function StaffJobPage() {
  const { id } = useParams();
  const { t, language } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();

  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetError, setSheetError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await complaintService.getComplaintDetails(id);
      if (res.success && res.data) {
        setJob(res.data);
        setErrorKey('');
      } else {
        setErrorKey('error.notFound');
      }
    } catch (err) {
      const status = err?.response?.status;
      setErrorKey(status === 404 || status === 403 ? 'error.notFound' : 'error.load');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const action = job ? getNextAction(job) : null;
  const stage = job ? getStage(job) : null;

  // The list's "Work finished" button links here with ?finish=1 to open the note sheet
  useEffect(() => {
    if (searchParams.get('finish') === '1' && action === 'finish') {
      setSheetOpen(true);
    }
  }, [searchParams, action]);

  const closeSheet = () => {
    setSheetOpen(false);
    setSheetError('');
    if (searchParams.get('finish')) {
      const next = new URLSearchParams(searchParams);
      next.delete('finish');
      setSearchParams(next, { replace: true });
    }
  };

  const run = async (name, note) => {
    setBusy(true);
    try {
      await performJobAction(name, id, note);
      setToast(t(TOAST_KEY[name]));
      if (name === 'finish') closeSheet();
      await load();
      return true;
    } catch (err) {
      const message = err?.response?.data?.message || t('error.action');
      if (name === 'finish') setSheetError(message);
      else setToast(message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const handlePrimary = () => (action === 'finish' ? setSheetOpen(true) : run(action));

  const dateText = (value) =>
    value
      ? new Date(value).toLocaleDateString(language === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      : '-';

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label={t('common.loading')}>
        <div className="h-8 w-28 animate-pulse rounded-lg bg-slate-200/70" />
        <div className="h-64 animate-pulse rounded-3xl bg-slate-200/70" />
      </div>
    );
  }

  if (errorKey || !job) {
    return (
      <div className="space-y-5">
        <BackLink t={t} />
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
          <Icon name="alert" className="mx-auto h-8 w-8 text-rose-600" />
          <p className="mt-2 text-lg font-semibold text-rose-800">{t(errorKey || 'error.notFound')}</p>
          {errorKey === 'error.load' && (
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                load();
              }}
              className="mt-4 h-12 rounded-xl bg-rose-600 px-6 text-base font-bold text-white hover:bg-rose-700"
            >
              {t('common.retry')}
            </button>
          )}
        </div>
      </div>
    );
  }

  const { room, block, floor, hostel } = getLocation(job);
  const studentName = job.studentId?.name;
  const hasBar = Boolean(action);

  return (
    <div className={`space-y-5 ${hasBar ? 'pb-28' : ''}`}>
      <BackLink t={t} />

      {toast && (
        <div role="status" className="flex items-start gap-3 rounded-2xl bg-emerald-600 p-4 text-lg font-semibold text-white shadow-md">
          <Icon name="check" className="mt-0.5 h-6 w-6 shrink-0" strokeWidth={3} />
          <span>{toast}</span>
        </div>
      )}

      {/* 1. Where, and where the job stands */}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <Icon name="pin" className="h-6 w-6" />
          </span>
          <div>
            <h1 className="whitespace-nowrap text-3xl font-bold leading-tight text-slate-900">
              {room ? t('job.room', { room }) : t('job.roomUnknown')}
            </h1>
            {block && <p className="text-lg text-slate-500">{describeBlock(t, block)}</p>}
          </div>
        </div>
        <div className="mt-4">
          <StageChip stage={stage} size="lg" />
        </div>

        {/* 2. What is wrong */}
        <div className="mt-5 border-t border-slate-100 pt-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">{t('job.whatIsWrong')}</p>
          <h2 className="mt-1 text-xl font-bold leading-snug text-slate-900">{job.title}</h2>
          {job.description && <p className="mt-2 text-lg leading-relaxed text-slate-600">{job.description}</p>}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {job.category && (
              <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-base font-medium text-slate-700">{t(`category.${job.category}`)}</span>
            )}
            {job.priority && (
              <span className={`rounded-lg px-2.5 py-1 text-base font-medium ${PRIORITY_STYLE[job.priority] || PRIORITY_STYLE.MEDIUM}`}>
                {t(`priority.${job.priority}`)}
              </span>
            )}
          </div>
        </div>

        {/* 3. How soon */}
        <div className="mt-4">
          <DueLine job={job} />
        </div>
      </section>

      {stage === 'redo' && job.reopenReason && (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
          <p className="flex items-center gap-2 text-base font-bold text-rose-800">
            <Icon name="redo" className="h-5 w-5" />
            {t('job.studentSaid')}
          </p>
          <p className="mt-1 text-lg text-rose-900">{job.reopenReason}</p>
        </section>
      )}

      {/* Where the job is on its way to done */}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <ProgressSteps done={getProgressSteps(job)} />
        {stage === 'waiting' && <p className="mt-4 rounded-xl bg-violet-50 p-3 text-base font-medium text-violet-800">{t('job.waitingNote')}</p>}
        {stage === 'done' && <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-base font-medium text-emerald-800">{t('job.doneNote')}</p>}
      </section>

      {/* Everything else, out of the way */}
      <details className="group rounded-2xl border border-slate-200 bg-white shadow-sm">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between px-5 text-lg font-semibold text-slate-700">
          {t('job.moreDetails')}
          <Icon name="chevron" className="h-5 w-5 text-slate-400 transition group-open:rotate-180" />
        </summary>
        <dl className="space-y-3 border-t border-slate-100 px-5 py-4 text-base">
          <Detail label={t('job.hostel')} value={hostel} />
          <Detail label={t('job.block')} value={block} />
          <Detail label={t('job.floor')} value={floor} />
          {studentName && <Detail label={t('job.reporter')} value={studentName} />}
          <Detail label={t('job.reportedOn')} value={dateText(job.createdAt || job.submittedAt)} />
          <Detail label={t('job.givenOn')} value={dateText(job.assignedAt)} />
          <p className="pt-1 text-sm text-slate-400">{job.complaintId}</p>
        </dl>
      </details>

      {hasBar && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 p-3 backdrop-blur-xs">
          <div className="mx-auto max-w-2xl">
            <button
              type="button"
              disabled={busy}
              onClick={handlePrimary}
              className={`h-16 w-full rounded-2xl text-xl font-bold text-white shadow-lg transition disabled:opacity-60 ${ACTION_STYLE[action]}`}
            >
              {busy ? t('action.wait') : t(`action.${action}`)}
            </button>
          </div>
        </div>
      )}

      <FinishSheet
        isOpen={sheetOpen}
        onClose={closeSheet}
        onSubmit={(note) => run('finish', note)}
        submitting={busy}
        error={sheetError}
      />
    </div>
  );
}

function BackLink({ t }) {
  return (
    <Link to="/staff/jobs" className="inline-flex h-12 items-center gap-2 rounded-xl pr-3 text-lg font-semibold text-brand-700">
      <Icon name="back" className="h-6 w-6" />
      {t('job.back')}
    </Link>
  );
}

function Detail({ label, value }) {
  if (value === '' || value === undefined || value === null) return null;
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-900">{value}</dd>
    </div>
  );
}
