import { useState } from 'react';
import BottomSheet from '../common/BottomSheet.jsx';
import { dayLabel } from './DayStrip.jsx';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { dishesText, parseDishes } from '../../utils/messPresentation.js';

const PROBLEM_KEY = { empty: 'mess.err.empty', tooMany: 'mess.err.tooMany', tooLong: 'mess.err.tooLong' };

/**
 * Add or change the dishes of one meal on one day. "Save and show to students" publishes it;
 * "Save as draft" keeps it hidden. By default the change is for this day only; the tick box makes
 * it the standing menu for that weekday, as a weekly timetable does.
 *
 * @param {{ meal: string, dateKey: string, menu: object | null,
 *           onSave: (input: { items: object[], isPublished: boolean, repeat: boolean }) => Promise<void>, onClose: () => void }} props
 */
export default function MenuSheet({ meal, dateKey, menu, onSave, onClose }) {
  const { t, language } = useLanguage();
  const [text, setText] = useState(() => dishesText(menu));
  const [repeat, setRepeat] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const weekday = dayLabel(dateKey, language, { weekday: 'long' });

  const save = async (isPublished) => {
    const { items, problem } = parseDishes(text);
    if (problem) {
      setError(t(PROBLEM_KEY[problem]));
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave({ items, isPublished, repeat });
    } catch (err) {
      setError(err.message || t('mess.err.save'));
      setSaving(false);
    }
  };

  return (
    <BottomSheet title={t('mess.sheet.title', { meal: t(`meal.${meal}`), day: dayLabel(dateKey, language) })} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label htmlFor="mess-dishes" className="text-sm font-semibold text-slate-600">
            {t('mess.sheet.dishes')}
          </label>
          <textarea
            id="mess-dishes"
            rows={6}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setError('');
            }}
            placeholder={t('mess.sheet.dishes.ph')}
            className="mt-1.5 w-full rounded-2xl border-2 border-slate-200 p-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-hidden focus:ring-4 focus:ring-brand-100"
          />
        </div>

        <label className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3.5 ring-1 ring-slate-200">
          <input type="checkbox" checked={repeat} onChange={(e) => setRepeat(e.target.checked)} className="mt-1 h-6 w-6 shrink-0 accent-brand-600" />
          <span>
            <span className="block text-base font-bold text-slate-800">{t('mess.sheet.repeat', { weekday })}</span>
            <span className="block text-sm text-slate-500">{t('mess.sheet.repeat.hint')}</span>
          </span>
        </label>

        {error && (
          <p role="alert" className="rounded-2xl bg-brand-50 p-3 text-base font-medium text-brand-800 ring-1 ring-brand-200">
            {error}
          </p>
        )}

        <div className="space-y-2.5">
          <button
            type="button"
            disabled={saving}
            onClick={() => save(true)}
            className="flex h-14 w-full items-center justify-center rounded-2xl bg-brand-600 text-lg font-bold text-white shadow-[0_8px_18px_-8px_rgba(200,42,65,0.7)] transition hover:bg-brand-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-brand-300 disabled:shadow-none"
          >
            {t('mess.sheet.saveShow')}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => save(false)}
            className="flex h-12 w-full items-center justify-center rounded-2xl border-2 border-slate-200 text-base font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            {t('mess.sheet.saveDraft')}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
