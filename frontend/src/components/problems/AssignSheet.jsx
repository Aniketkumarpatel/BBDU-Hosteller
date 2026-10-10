import { useEffect, useState } from 'react';
import Icon from '../jobs/icons.jsx';
import { PRIORITY_STYLE } from '../jobs/stageStyle.js';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { getLocation } from '../../utils/jobPresentation.js';

const PRIORITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const REASON_KEYS = ['assign.reason.r1', 'assign.reason.r2', 'assign.reason.r3', 'assign.reason.r4'];
// The server rejects a reassignment reason shorter than 5 characters
const MIN_REASON_LENGTH = 5;

/**
 * "Give to a technician" / "Change technician" sheet (DEC-029). The Warden picks a
 * person, not a department: the trade comes from the technician. Right-trade
 * technicians are listed first with how many jobs each already has, so the choice can
 * be made at a glance. Slides up on a phone, centred on a larger screen.
 *
 * @param {{ isOpen: boolean, onClose: () => void, problem: object, technicians: Array,
 *   mode: 'give' | 'change', askUrgency?: boolean (false when the problem was already checked), onSubmit: (choice: object) => void, submitting: boolean, error: string }} props
 */
export default function AssignSheet({ isOpen, onClose, problem, technicians, mode, askUrgency = true, onSubmit, submitting, error }) {
  const { t } = useLanguage();
  const [pickedId, setPickedId] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [reasonKey, setReasonKey] = useState('');
  const [reasonText, setReasonText] = useState('');
  const [hint, setHint] = useState('');

  useEffect(() => {
    if (!isOpen) return undefined;
    setPickedId('');
    setPriority(problem?.priority || 'MEDIUM');
    setReasonKey('');
    setReasonText('');
    setHint('');
    const onKey = (e) => e.key === 'Escape' && !submitting && onClose();
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [isOpen, problem?._id, problem?.priority, onClose, submitting]);

  if (!isOpen || !problem) return null;

  const changing = mode === 'change';
  const { room } = getLocation(problem);
  const reason = [reasonKey ? t(reasonKey) : '', reasonText.trim()].filter(Boolean).join('. ');

  const handleSubmit = () => {
    const technician = technicians.find((tech) => tech.id === pickedId);
    if (!technician) {
      setHint(t('assign.pickOne'));
      return;
    }
    if (changing && reason.length < MIN_REASON_LENGTH) {
      setHint(t('assign.reasonShort'));
      return;
    }
    setHint('');
    onSubmit({ technician, priority, reason });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-labelledby="assign-title">
      <div className="absolute inset-0 bg-slate-900/50" onClick={() => !submitting && onClose()} />

      <div className="relative max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 pb-6 shadow-2xl sm:max-w-lg sm:rounded-3xl">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-200 sm:hidden" />
        <h2 id="assign-title" className="text-2xl font-bold text-slate-900">
          {changing ? t('assign.changeTitle') : t('assign.title')}
        </h2>
        <p className="mt-1 text-base text-slate-500">
          {room ? `${t('job.room', { room })} · ` : ''}
          {problem.title}
        </p>

        {!changing && askUrgency && (
          <section className="mt-5">
            <p className="text-lg font-bold text-slate-800">{t('assign.urgency')}</p>
            <div className="mt-2 grid grid-cols-2 gap-2.5">
              {PRIORITIES.map((key) => {
                const on = priority === key;
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setPriority(key)}
                    className={`min-h-12 rounded-xl border-2 px-3 text-base font-semibold transition ${
                      on ? `border-brand-600 ${PRIORITY_STYLE[key]}` : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    {on && <span aria-hidden="true">{'✓ '}</span>}
                    {t(`priority.${key}`)}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        <section className="mt-5">
          <p className="text-lg font-bold text-slate-800">{t('assign.who')}</p>
          {technicians.length === 0 ? (
            <p className="mt-2 rounded-xl bg-amber-50 p-3 text-base font-medium text-amber-800">{t('assign.noTechnicians')}</p>
          ) : (
            <ul className="mt-2 space-y-2.5" role="radiogroup" aria-label={t('assign.who')}>
              {technicians.map((tech) => {
                const on = pickedId === tech.id;
                return (
                  <li key={tech.id}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setPickedId(tech.id)}
                      className={`flex w-full items-center gap-3 rounded-2xl border-2 p-3 text-left transition ${
                        on ? 'border-brand-600 bg-brand-50' : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                          on ? 'bg-brand-600 text-white' : 'border-2 border-slate-300 text-transparent'
                        }`}
                      >
                        <Icon name="check" className="h-5 w-5" strokeWidth={3} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block break-words text-lg font-bold leading-snug text-slate-900">{tech.name}</span>
                        <span className="block break-words text-base text-slate-500">{tech.trade}</span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1">
                        {tech.suggested && (
                          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-sm font-semibold text-emerald-800">
                            {t('assign.suggested')}
                          </span>
                        )}
                        <span className="text-sm text-slate-500">
                          {tech.openJobs === 0
                            ? t('assign.openJobs.none')
                            : tech.openJobs === 1
                              ? t('assign.openJobs.one')
                              : t('assign.openJobs.some', { n: tech.openJobs })}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {changing && (
          <section className="mt-5">
            <p className="text-lg font-bold text-slate-800">{t('assign.reason')}</p>
            <div className="mt-2 flex flex-wrap gap-2.5">
              {REASON_KEYS.map((key) => {
                const on = reasonKey === key;
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setReasonKey(on ? '' : key)}
                    className={`min-h-12 rounded-xl border-2 px-4 text-base font-semibold transition ${
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
              maxLength={300}
              placeholder={t('assign.reasonPlaceholder')}
              className="mt-3 w-full rounded-xl border-2 border-slate-200 p-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-hidden"
            />
          </section>
        )}

        {(hint || error) && (
          <p role="alert" className="mt-3 text-base font-medium text-rose-600">
            {error || hint}
          </p>
        )}

        <div className="mt-5 grid grid-cols-3 gap-3">
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="h-14 rounded-xl border-2 border-slate-200 text-base font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            disabled={submitting || technicians.length === 0}
            onClick={handleSubmit}
            className="col-span-2 h-14 rounded-xl bg-brand-600 text-lg font-bold text-white shadow-sm hover:bg-brand-700 disabled:opacity-60"
          >
            {submitting ? t('action.wait') : changing ? t('problem.change') : t('assign.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
