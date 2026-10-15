import { useLanguage } from '../../i18n/LanguageContext.jsx';

const LOCALE = { en: 'en-IN', hi: 'hi-IN' };

/** "Mon 16" style label for a calendar date, in the chosen language. */
export const dayLabel = (key, language, options = { weekday: 'short', day: 'numeric' }) =>
  new Intl.DateTimeFormat(LOCALE[language] || LOCALE.en, { ...options, timeZone: 'UTC' }).format(new Date(`${key}T00:00:00Z`));

/**
 * The row of day buttons. Yesterday, today and tomorrow have their own names; any other day shows
 * its weekday and date.
 * @param {{ days: Array<{ key: string, offset: number }>, selected: string, onSelect: (key: string) => void }} props
 */
export default function DayStrip({ days, selected, onSelect }) {
  const { t, language } = useLanguage();
  const name = (day) => {
    if (day.offset === -1) return t('mess.yesterday');
    if (day.offset === 0) return t('mess.today');
    if (day.offset === 1) return t('mess.tomorrow');
    return dayLabel(day.key, language);
  };

  return (
    <div role="tablist" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {days.map((day) => {
        const on = day.key === selected;
        return (
          <button
            key={day.key}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onSelect(day.key)}
            className={`h-11 shrink-0 whitespace-nowrap rounded-full px-5 text-base font-bold transition ${
              on ? 'bg-brand-600 text-white shadow-[0_6px_14px_-6px_rgba(200,42,65,0.7)]' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:ring-slate-300'
            }`}
          >
            {name(day)}
          </button>
        );
      })}
    </div>
  );
}
