import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import complaintService from '../../services/complaintService.js';
import { changeTechnician, giveToTechnician } from '../../services/problemActionService.js';
import StageChip from '../../components/jobs/StageChip.jsx';
import DueLine from '../../components/jobs/DueLine.jsx';
import ProgressSteps from '../../components/jobs/ProgressSteps.jsx';
import Icon from '../../components/jobs/icons.jsx';
import AssignSheet from '../../components/problems/AssignSheet.jsx';
import { PRIORITY_STYLE } from '../../components/jobs/stageStyle.js';
import { getLocation, getProgressSteps } from '../../utils/jobPresentation.js';
import { describeBlock } from '../../utils/jobFormat.js';
import {
  canChangeTechnician,
  canGiveToTechnician,
  countOpenByTechnician,
  getWardenStage,
  needsTriage,
  rankTechnicians,
} from '../../utils/problemPresentation.js';

/**
 * One problem, for the Warden (DEC-029). Answers in order: where, what is wrong, who has
 * it and how it stands, and what the Warden can do. History stays under "More details".
 */
export default function WardenProblemPage() {
  const { id } = useParams();
  const { t, language } = useLanguage();

  const [problem, setProblem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState('');
  const [toast, setToast] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [staff, setStaff] = useState([]);
  const [openCounts, setOpenCounts] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [sheetError, setSheetError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await complaintService.getComplaintDetails(id);
      if (res.success && res.data) {
        setProblem(res.data);
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

  const giveable = canGiveToTechnician(problem);
  const changeable = canChangeTechnician(problem);

  const openSheet = useCallback(async () => {
    setSheetError('');
    setSheetOpen(true);
    try {
      // Workload per technician comes from the hostel's current problems
      const [staffRes, listRes] = await Promise.all([
        complaintService.getEligibleAssignees(id),
        complaintService.listComplaints().catch(() => null),
      ]);
      if (staffRes.success && Array.isArray(staffRes.data)) setStaff(staffRes.data);
      if (listRes?.success && Array.isArray(listRes.data)) setOpenCounts(countOpenByTechnician(listRes.data));
    } catch {
      setSheetError(t('error.load'));
    }
  }, [id, t]);

  const technicians = useMemo(() => (problem ? rankTechnicians(staff, problem, openCounts) : []), [staff, problem, openCounts]);

  const closeSheet = useCallback(() => {
    setSheetOpen(false);
    setSheetError('');
  }, []);

  const handleSubmit = async ({ technician, priority, reason }) => {
    setSubmitting(true);
    setSheetError('');
    try {
      if (giveable) {
        await giveToTechnician(problem, { technician, priority });
        setToast(t('toast.assigned', { name: technician.name }));
      } else {
        await changeTechnician(problem, { technician, reason });
        setToast(t('toast.reassigned', { name: technician.name }));
      }
      closeSheet();
      await load();
    } catch (err) {
      setSheetError(err?.response?.data?.message || (err.partial ? t('error.assignPartial') : t('error.assign')));
      if (err.partial) await load();
    } finally {
      setSubmitting(false);
    }
  };

  const dateText = (value) =>
    value
      ? new Date(value).toLocaleDateString(language === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      : '';

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label={t('common.loading')}>
        <div className="h-8 w-28 animate-pulse rounded-lg bg-slate-200/70" />
        <div className="h-64 animate-pulse rounded-3xl bg-slate-200/70" />
      </div>
    );
  }

  if (errorKey || !problem) {
    return (
      <div className="space-y-5">
        <BackLink t={t} />
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
          <Icon name="alert" className="mx-auto h-8 w-8 text-rose-600" />
          <p className="mt-2 text-lg font-semibold text-rose-800">{t(errorKey || 'error.notFound')}</p>
        </div>
      </div>
    );
  }

  const stage = getWardenStage(problem);
  const { room, block, floor, hostel } = getLocation(problem);
  const holder = problem.assignedTo;
  const student = problem.studentId;
  const hasBar = giveable || changeable;

  return (
    <div className={`space-y-5 ${hasBar ? 'pb-28' : ''}`}>
      <BackLink t={t} />

      {toast && (
        <div role="status" className="flex items-start gap-3 rounded-2xl bg-emerald-600 p-4 text-lg font-semibold text-white shadow-md">
          <Icon name="check" className="mt-0.5 h-6 w-6 shrink-0" strokeWidth={3} />
          <span>{toast}</span>
        </div>
      )}

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
          <StageChip stage={stage} size="lg" perspective="warden" />
        </div>

        <div className="mt-5 border-t border-slate-100 pt-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-400">{t('job.whatIsWrong')}</p>
          <h2 className="mt-1 text-xl font-bold leading-snug text-slate-900">{problem.title}</h2>
          {problem.description && <p className="mt-2 text-lg leading-relaxed text-slate-600">{problem.description}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {problem.category && (
              <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-base font-medium text-slate-700">{t(`category.${problem.category}`)}</span>
            )}
            {problem.priority && (
              <span className={`rounded-lg px-2.5 py-1 text-base font-medium ${PRIORITY_STYLE[problem.priority] || PRIORITY_STYLE.MEDIUM}`}>
                {t(`priority.${problem.priority}`)}
              </span>
            )}
          </div>
        </div>

        <div className="mt-4">
          <DueLine job={problem} />
        </div>
      </section>

      {/* Who has it */}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
            <Icon name="tool" className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-xl font-bold text-slate-900">
              {holder?.name ? t('problem.with', { name: holder.name }) : t('problem.nobody')}
            </p>
            {holder?.phone && (
              <a href={`tel:${holder.phone}`} className="text-base font-semibold text-brand-700">
                {t('problem.call')} {holder.phone}
              </a>
            )}
          </div>
        </div>

        {holder && (
          <div className="mt-5">
            <ProgressSteps done={getProgressSteps(problem)} />
          </div>
        )}
        {stage === 'redo' && (
          <div className="mt-4 rounded-xl bg-rose-50 p-3 text-base text-rose-900">
            <p className="font-bold">{t('job.studentSaid')}</p>
            {problem.reopenReason && <p className="mt-1">{problem.reopenReason}</p>}
            <p className="mt-2 text-rose-700">{t('problem.redoNote')}</p>
          </div>
        )}
        {stage === 'waiting' && (
          <div className="mt-4 rounded-xl bg-violet-50 p-3 text-base text-violet-900">
            {problem.resolutionNote && (
              <>
                <p className="font-bold">{t('problem.techDid')}</p>
                <p className="mt-1">{problem.resolutionNote}</p>
              </>
            )}
            <p className={problem.resolutionNote ? 'mt-2 text-violet-700' : ''}>{t('problem.waitNote')}</p>
          </div>
        )}
        {stage === 'done' && <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-base font-medium text-emerald-800">{t('problem.doneNote')}</p>}
      </section>

      <details className="group rounded-2xl border border-slate-200 bg-white shadow-sm">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between px-5 text-lg font-semibold text-slate-700">
          {t('job.moreDetails')}
          <Icon name="chevron" className="h-5 w-5 text-slate-400 transition group-open:rotate-180" />
        </summary>
        <dl className="space-y-3 border-t border-slate-100 px-5 py-4 text-base">
          <Detail label={t('problem.student')} value={student?.name} />
          {student?.phone && (
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-slate-500">{t('problem.call')}</dt>
              <dd className="text-right font-medium">
                <a href={`tel:${student.phone}`} className="text-brand-700">
                  {student.phone}
                </a>
              </dd>
            </div>
          )}
          <Detail label={t('job.hostel')} value={hostel} />
          <Detail label={t('job.block')} value={block} />
          <Detail label={t('job.floor')} value={floor} />
          <Detail label={t('job.reportedOn')} value={dateText(problem.createdAt || problem.submittedAt)} />
          <Detail label={t('job.givenOn')} value={dateText(problem.assignedAt)} />
          <p className="pt-1 text-sm text-slate-400">{problem.complaintId}</p>
        </dl>
      </details>

      {hasBar && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 p-3 backdrop-blur-xs">
          <div className="mx-auto max-w-3xl">
            <button
              type="button"
              onClick={openSheet}
              className={`h-16 w-full rounded-2xl text-xl font-bold shadow-lg transition ${
                giveable ? 'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800' : 'border-2 border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
              }`}
            >
              {giveable ? t('problem.give') : t('problem.change')}
            </button>
          </div>
        </div>
      )}

      <AssignSheet
        isOpen={sheetOpen}
        onClose={closeSheet}
        problem={problem}
        technicians={technicians}
        mode={giveable ? 'give' : 'change'}
        askUrgency={needsTriage(problem)}
        onSubmit={handleSubmit}
        submitting={submitting}
        error={sheetError}
      />
    </div>
  );
}

function BackLink({ t }) {
  return (
    <Link to="/warden/problems" className="inline-flex h-12 items-center gap-2 rounded-xl pr-3 text-lg font-semibold text-brand-700">
      <Icon name="back" className="h-6 w-6" />
      {t('problem.back')}
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
