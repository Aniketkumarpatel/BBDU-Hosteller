import Icon from './icons.jsx';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

const STEPS = ['job.steps.got', 'job.steps.started', 'job.steps.finished', 'job.steps.confirmed'];

/**
 * Four-step path for one job. `done` is how many steps are complete (0 to 4); the
 * next step is highlighted so the technician always sees where the job stands.
 */
export default function ProgressSteps({ done }) {
  const { t } = useLanguage();

  return (
    <ol className="grid grid-cols-4 gap-1" aria-label="Progress">
      {STEPS.map((key, index) => {
        const complete = index < done;
        const current = index === done;
        return (
          <li key={key} className="flex flex-col items-center text-center">
            <span
              className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${
                complete
                  ? 'bg-emerald-600 text-white'
                  : current
                    ? 'bg-brand-600 text-white ring-4 ring-brand-100'
                    : 'bg-slate-100 text-slate-400'
              }`}
            >
              {complete ? <Icon name="check" className="h-5 w-5" strokeWidth={3} /> : index + 1}
            </span>
            <span
              className={`mt-1.5 text-xs leading-tight ${
                complete || current ? 'font-semibold text-slate-800' : 'text-slate-400'
              }`}
            >
              {t(key)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
