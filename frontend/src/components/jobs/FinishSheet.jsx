import { useEffect, useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

const PHRASE_KEYS = ['finish.p1', 'finish.p2', 'finish.p3', 'finish.p4', 'finish.p5', 'finish.p6'];
// The server rejects work notes shorter than 5 characters
const MIN_NOTE_LENGTH = 5;

/**
 * "What did you do?" sheet shown when a technician finishes a job. Tapping the ready
 * phrases is enough, typing is optional, so nobody has to write to finish a job.
 * Slides up from the bottom on a phone, centred on a larger screen.
 */
export default function FinishSheet({ isOpen, onClose, onSubmit, submitting, error }) {
  const { t } = useLanguage();
  const [picked, setPicked] = useState([]);
  const [text, setText] = useState('');
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    if (!isOpen) return undefined;
    setPicked([]);
    setText('');
    setShowHint(false);
    const onKey = (e) => e.key === 'Escape' && !submitting && onClose();
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [isOpen, onClose, submitting]);

  if (!isOpen) return null;

  const note = [...picked.map((key) => t(key)), text.trim()].filter(Boolean).join('. ');
  const valid = note.length >= MIN_NOTE_LENGTH;

  const togglePhrase = (key) =>
    setPicked((current) => (current.includes(key) ? current.filter((k) => k !== key) : [...current, key]));

  const handleSubmit = () => {
    if (!valid) {
      setShowHint(true);
      return;
    }
    onSubmit(note);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-labelledby="finish-title">
      <div className="absolute inset-0 bg-slate-900/50" onClick={() => !submitting && onClose()} />

      <div className="relative max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 pb-6 shadow-2xl sm:max-w-lg sm:rounded-3xl">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-200 sm:hidden" />
        <h2 id="finish-title" className="text-2xl font-bold text-slate-900">
          {t('finish.title')}
        </h2>
        <p className="mt-1 text-base text-slate-500">{t('finish.hint')}</p>

        <div className="mt-4 flex flex-wrap gap-2.5">
          {PHRASE_KEYS.map((key) => {
            const on = picked.includes(key);
            return (
              <button
                key={key}
                type="button"
                aria-pressed={on}
                onClick={() => togglePhrase(key)}
                className={`min-h-12 rounded-xl border-2 px-4 text-base font-semibold transition ${
                  on
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                {on && <span aria-hidden="true">{'✓ '}</span>}
                {t(key)}
              </button>
            );
          })}
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          maxLength={1500}
          placeholder={t('finish.placeholder')}
          className="mt-4 w-full rounded-xl border-2 border-slate-200 p-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-hidden"
        />

        {showHint && !valid && (
          <p role="alert" className="mt-2 text-base font-medium text-rose-600">
            {t('finish.tooShort')}
          </p>
        )}
        {error && (
          <p role="alert" className="mt-2 text-base font-medium text-rose-600">
            {error}
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
            disabled={submitting}
            onClick={handleSubmit}
            className="col-span-2 h-14 rounded-xl bg-emerald-600 text-lg font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
          >
            {submitting ? t('action.wait') : t('action.finish')}
          </button>
        </div>
      </div>
    </div>
  );
}
