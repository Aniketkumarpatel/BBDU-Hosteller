import Icon from '../jobs/icons.jsx';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { buildTimeline } from '../../utils/studentPresentation.js';
import { formatWhen } from '../../utils/studentFormat.js';

/** What has happened and what comes next, with who and when. Replaces a row of dots. */
export default function Timeline({ problem }) {
  const { t, language } = useLanguage();
  const steps = buildTimeline(problem);

  const label = (step) => {
    switch (step.key) {
      case 'reported':
        return t('tl.reported');
      case 'given':
        return step.name ? t('tl.given', { name: step.name }) : t('tl.givenAnon');
      case 'started':
        return step.name ? t('tl.started', { name: step.name }) : t('tl.startedAnon');
      case 'finished':
        return t('tl.finished');
      default:
        return t('tl.confirmed');
    }
  };

  return (
    <ol className="space-y-0">
      {steps.map((step, index) => {
        const last = index === steps.length - 1;
        return (
          <li key={step.key} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                  step.done
                    ? 'bg-green-600 text-white'
                    : step.current
                      ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                      : 'border-2 border-slate-200 bg-white'
                }`}
              >
                {step.done && <Icon name="check" className="h-4 w-4" strokeWidth={3} />}
                {step.current && !step.done && <span className="h-2 w-2 rounded-full bg-white" />}
              </span>
              {!last && <span className={`w-0.5 flex-1 ${step.done ? 'bg-green-600' : 'bg-slate-200'}`} style={{ minHeight: '1.75rem' }} />}
            </div>
            <div className="pb-5">
              <p className={`text-base leading-7 ${step.done || step.current ? 'font-semibold text-slate-900' : 'text-slate-400'}`}>{label(step)}</p>
              {step.done && step.at && <p className="text-sm text-slate-500">{formatWhen(step.at, language)}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
