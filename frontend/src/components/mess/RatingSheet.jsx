import { useState } from 'react';
import BottomSheet from '../common/BottomSheet.jsx';
import Star from './Stars.jsx';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

const QUICK = [
  { key: 'taste', labelKey: 'mess.rate.taste' },
  { key: 'clean', labelKey: 'mess.rate.clean' },
  { key: 'enough', labelKey: 'mess.rate.enough' },
];
const ANSWERS = [
  { value: 'good', labelKey: 'mess.rate.good' },
  { value: 'ok', labelKey: 'mess.rate.ok' },
  { value: 'bad', labelKey: 'mess.rate.bad' },
];

/**
 * Rate one meal: five big stars and three optional quick answers. Everything else the server
 * asks for is worked out from those (see `starsToFeedback`).
 *
 * @param {{ mealLabel: string, onSubmit: (input: { stars: number, quick: object, comments: string }) => Promise<void>, onClose: () => void }} props
 *   `onSubmit` rejects with an Error whose message is already in the person's language.
 */
export default function RatingSheet({ mealLabel, onSubmit, onClose }) {
  const { t } = useLanguage();
  const [stars, setStars] = useState(0);
  const [quick, setQuick] = useState({});
  const [comments, setComments] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const send = async (e) => {
    e.preventDefault();
    if (stars < 1) {
      setError(t('mess.rate.pickStars'));
      return;
    }
    setSending(true);
    setError('');
    try {
      await onSubmit({ stars, quick, comments: comments.trim() });
    } catch (err) {
      setError(err.message || t('mess.rate.err'));
      setSending(false);
    }
  };

  return (
    <BottomSheet title={t('mess.rate.title', { meal: mealLabel })} onClose={onClose}>
      <form onSubmit={send} className="space-y-5">
        <div>
          <p className="text-sm font-semibold text-slate-600">{t('mess.rate.stars')}</p>
          <div className="mt-2 flex justify-between gap-1" role="radiogroup" aria-label={t('mess.rate.stars')}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={stars === n}
                aria-label={`${n} / 5`}
                onClick={() => {
                  setStars(n);
                  setError('');
                }}
                className="flex h-14 w-14 items-center justify-center rounded-2xl transition active:scale-90"
              >
                <Star filled={n <= stars} className="h-11 w-11" />
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold text-slate-600">{t('mess.rate.more')}</p>
          <div className="mt-2 space-y-3">
            {QUICK.map((q) => (
              <div key={q.key} className="flex items-center justify-between gap-2">
                <span className="text-base font-semibold text-slate-800">{t(q.labelKey)}</span>
                <div className="flex gap-1.5">
                  {ANSWERS.map((a) => {
                    const on = quick[q.key] === a.value;
                    return (
                      <button
                        key={a.value}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setQuick((prev) => ({ ...prev, [q.key]: on ? undefined : a.value }))}
                        className={`h-11 min-w-16 rounded-full px-3 text-sm font-bold transition ${on ? 'bg-brand-600 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200'}`}
                      >
                        {t(a.labelKey)}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="mess-rate-comment" className="text-sm font-semibold text-slate-600">
            {t('mess.rate.comment')}
          </label>
          <textarea
            id="mess-rate-comment"
            rows={2}
            maxLength={500}
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder={t('mess.rate.comment.ph')}
            className="mt-1.5 w-full rounded-2xl border-2 border-slate-200 p-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-hidden focus:ring-4 focus:ring-brand-100"
          />
        </div>

        {error && (
          <p role="alert" className="rounded-2xl bg-brand-50 p-3 text-base font-medium text-brand-800 ring-1 ring-brand-200">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={sending}
          className="flex h-14 w-full items-center justify-center rounded-2xl bg-brand-600 text-lg font-bold text-white shadow-[0_8px_18px_-8px_rgba(200,42,65,0.7)] transition hover:bg-brand-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-brand-300 disabled:shadow-none"
        >
          {sending ? t('mess.rate.sending') : t('mess.rate.send')}
        </button>
      </form>
    </BottomSheet>
  );
}
