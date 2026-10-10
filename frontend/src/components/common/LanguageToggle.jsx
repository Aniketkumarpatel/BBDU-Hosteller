import { useLanguage } from '../../i18n/LanguageContext.jsx';

const OPTIONS = [
  { code: 'en', labelKey: 'lang.en' },
  { code: 'hi', labelKey: 'lang.hi' },
];

/**
 * Two-button language switch, always visible so nobody has to hunt for it.
 * Each button shows its own language name so it can be read in either language.
 */
export default function LanguageToggle() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div role="group" aria-label="Language" className="inline-flex shrink-0 rounded-full border border-slate-200 bg-white p-0.5">
      {OPTIONS.map((option) => {
        const active = language === option.code;
        return (
          <button
            key={option.code}
            type="button"
            aria-pressed={active}
            onClick={() => setLanguage(option.code)}
            className={`h-9 min-w-12 rounded-full px-3 text-sm font-semibold transition ${
              active ? 'bg-brand-600 text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t(option.labelKey)}
          </button>
        );
      })}
    </div>
  );
}
