import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import complaintService from '../../services/complaintService.js';
import StudentStatusChip from '../../components/student/StudentStatusChip.jsx';
import EtaLine from '../../components/student/EtaLine.jsx';
import Timeline from '../../components/student/Timeline.jsx';
import Icon from '../../components/jobs/icons.jsx';
import CategoryArt from '../../components/student/CategoryArt.jsx';
import { getStudentStage, needsConfirmation } from '../../utils/studentPresentation.js';

const REASON_KEYS = ['confirm.reason.r1', 'confirm.reason.r2', 'confirm.reason.r3', 'confirm.reason.r4'];
// The server rejects a "not fixed" reason shorter than 5 characters
const MIN_REASON_LENGTH = 5;

/**
 * Follow one problem like an order (DEC-031): a clear headline, the promised time, a real
 * timeline, the technician with a call button, and, once the work is done, a plain
 * "Is it fixed?" with Yes and No.
 */
export default function StudentProblemPage() {
  const { id } = useParams();
  const { t } = useLanguage();

  const [problem, setProblem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState('');
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [reasonKey, setReasonKey] = useState('');
  const [reasonText, setReasonText] = useState('');
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

  const accept = async () => {
    setBusy(true);
    try {
      await complaintService.verifyComplaint(id, { decision: 'ACCEPT' });
      setToast(t('toast.confirmed'));
      await load();
    } catch (err) {
      setToast(err?.response?.data?.message || t('error.action'));
    } finally {
      setBusy(false);
    }
  };

  const reason = [reasonKey ? t(reasonKey) : '', reasonText.trim()].filter(Boolean).join('. ');

  const reject = async () => {
    if (reason.length < MIN_REASON_LENGTH) {
      setSheetError(t('confirm.reasonShort'));
      return;
    }
    setBusy(true);
    setSheetError('');
    try {
      await complaintService.verifyComplaint(id, { decision: 'REJECT', reopenReason: reason });
      setSheetOpen(false);
      setToast(t('toast.reopened'));
      await load();
    } catch (err) {
      setSheetError(err?.response?.data?.message || t('error.action'));
    } finally {
      setBusy(false);
    }
  };

  const openSheet = () => {
    setReasonKey('');
    setReasonText('');
    setSheetError('');
    setSheetOpen(true);
  };

  const back = (
    <Link to="/student/problems" className="inline-flex h-12 items-center gap-2 pr-3 text-lg font-bold text-brand-600">
      <Icon name="back" className="h-6 w-6" />
      {t('nav.problems')}
    </Link>
  );

  if (loading) {
    return (
      <div className="space-y-4 px-4 pt-4" aria-busy="true" aria-label={t('common.loading')}>
        <div className="h-8 w-28 animate-pulse rounded-lg bg-slate-100" />
        <div className="h-56 animate-pulse rounded-3xl bg-slate-100" />
      </div>
    );
  }

  if (errorKey || !problem) {
    return (
      <div className="space-y-4 px-4 pt-4">
        {back}
        <div role="alert" className="rounded-3xl border border-brand-200 bg-brand-50 p-6 text-center">
          <p className="text-lg font-semibold text-brand-800">{t(errorKey || 'error.notFound')}</p>
        </div>
      </div>
    );
  }

  const stage = getStudentStage(problem);
  const holder = problem.assignedTo;
  const name = holder?.name || t('strack.someone');
  const headline = t(`strack.${stage}`, { name });

  return (
    <div className="space-y-4 px-4 pt-2">
      {back}

      {toast && (
        <div role="status" className="flex items-start gap-3 rounded-2xl bg-green-600 p-4 text-lg font-semibold text-white shadow-md">
          <Icon name="check" className="mt-0.5 h-6 w-6 shrink-0" strokeWidth={3} />
          <span>{toast}</span>
        </div>
      )}

      <section className="rounded-3xl border border-slate-200 bg-white p-5 text-center shadow-[0_2px_10px_rgba(0,0,0,0.07)]">
        <CategoryArt category={problem.category} size="h-20 w-20" iconSize="h-10 w-10" className="mx-auto" />
        <h1 className="mt-3 text-2xl font-bold leading-tight text-slate-900">{headline}</h1>
        <div className="mt-2">
          <StudentStatusChip stage={stage} size="lg" />
        </div>
        <EtaLine problem={problem} className="mt-3 justify-center" />
      </section>

      {needsConfirmation(problem) && (
        <section className="rounded-3xl bg-brand-50 p-5 text-center ring-1 ring-brand-200">
          <p className="text-xl font-bold text-brand-800">{t('confirm.ask')}</p>
          {problem.resolutionNote && <p className="mt-1 text-base text-slate-700">{problem.resolutionNote}</p>}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button type="button" disabled={busy} onClick={openSheet} className="h-14 rounded-2xl border-2 border-brand-600 bg-white text-lg font-bold text-brand-700 disabled:opacity-60">
              {t('confirm.no')}
            </button>
            <button type="button" disabled={busy} onClick={accept} className="h-14 rounded-2xl bg-green-600 text-lg font-bold text-white shadow-sm disabled:opacity-60">
              {busy ? t('action.wait') : t('confirm.yes')}
            </button>
          </div>
        </section>
      )}

      {stage === 'redo' && problem.reopenReason && (
        <section className="rounded-3xl bg-orange-50 p-4 ring-1 ring-orange-200">
          <p className="text-base font-bold text-orange-900">{t('confirm.youSaid')}</p>
          <p className="mt-1 text-base text-orange-900">{problem.reopenReason}</p>
        </section>
      )}

      <section className="rounded-3xl border border-slate-200 bg-white p-5">
        <Timeline problem={problem} />
      </section>

      {holder && (
        <section className="flex items-center gap-3 rounded-3xl border border-slate-200 bg-white p-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-50 text-lg font-bold text-brand-600">
            {(holder.name || '?').trim().charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-500">{t('tech.title')}</p>
            <p className="truncate text-lg font-bold text-slate-900">{holder.name}</p>
          </div>
          {holder.phone && (
            <a
              href={`tel:${holder.phone}`}
              aria-label={`${t('problem.call')} ${holder.name}`}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-brand-600 text-brand-600 transition active:scale-95"
            >
              <Icon name="phone" className="h-6 w-6" />
            </a>
          )}
        </section>
      )}

      <section className="rounded-3xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-bold text-slate-900">{problem.title}</h2>
        <p className="mt-1 text-sm text-slate-500">{t(`category.${problem.category}`)}</p>
        {problem.description && <p className="mt-3 text-base leading-relaxed text-slate-700">{problem.description}</p>}
        <p className="mt-3 text-xs text-slate-400">{problem.complaintId}</p>
      </section>

      {sheetOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-labelledby="reopen-title">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => !busy && setSheetOpen(false)} />
          <div className="relative w-full max-w-xl rounded-t-3xl bg-white p-5 pb-7 shadow-2xl">
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-200" />
            <h2 id="reopen-title" className="text-2xl font-bold text-slate-900">
              {t('confirm.noTitle')}
            </h2>
            <div className="mt-4 flex flex-wrap gap-2.5">
              {REASON_KEYS.map((key) => {
                const on = reasonKey === key;
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setReasonKey(on ? '' : key)}
                    className={`min-h-12 rounded-2xl border-2 px-4 text-base font-semibold transition ${
                      on ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    {t(key)}
                  </button>
                );
              })}
            </div>
            <textarea
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder={t('confirm.reasonPlaceholder')}
              className="mt-4 w-full rounded-2xl border-2 border-slate-200 p-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-hidden"
            />
            {sheetError && (
              <p role="alert" className="mt-2 text-base font-medium text-brand-700">
                {sheetError}
              </p>
            )}
            <div className="mt-5 grid grid-cols-3 gap-3">
              <button type="button" disabled={busy} onClick={() => setSheetOpen(false)} className="h-14 rounded-2xl border-2 border-slate-200 text-base font-semibold text-slate-700 disabled:opacity-50">
                {t('common.cancel')}
              </button>
              <button type="button" disabled={busy} onClick={reject} className="col-span-2 h-14 rounded-2xl bg-brand-600 text-lg font-bold text-white shadow-sm disabled:opacity-60">
                {busy ? t('action.wait') : t('confirm.send')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
