import { Link } from 'react-router-dom';
import Icon from '../jobs/icons.jsx';
import { STAGE_STYLE } from '../jobs/stageStyle.js';
import { CATEGORY_VISUAL, DEFAULT_CATEGORY_VISUAL, STUDENT_STAGE_STYLE_KEY } from './categoryStyle.js';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { getEta, getProgress, getStudentStage, needsConfirmation } from '../../utils/studentPresentation.js';
import { formatLeft, formatWhen } from '../../utils/studentFormat.js';

const DOTS = 4;

/**
 * One of the student's problems laid out like a Zomato restaurant card (DEC-032): a coloured
 * cover with the category picture and progress dots, then the title, a time pill,
 * a status and promise line, and a tinted strip for who has it. The whole card opens the tracker.
 */
export default function TrackerCard({ problem }) {
  const { t, language } = useLanguage();
  const stage = getStudentStage(problem);
  const visual = CATEGORY_VISUAL[problem.category] || DEFAULT_CATEGORY_VISUAL;
  const style = STAGE_STYLE[STUDENT_STAGE_STYLE_KEY[stage]];
  const filled = getProgress(problem);
  const eta = getEta(problem);
  const holder = problem.assignedTo?.name;
  const confirm = needsConfirmation(problem);
  const categoryName = t(`category.${problem.category}`);

  const stripText = confirm ? t('confirm.ask') : t(`strack.${stage}`, { name: holder || t('strack.someone') });

  return (
    <Link
      to={`/student/problems/${problem._id}`}
      className="block overflow-hidden rounded-3xl bg-white shadow-[0_6px_20px_-6px_rgba(15,23,42,0.22)] ring-1 ring-black/5 transition active:scale-[0.99] focus:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500"
    >
      <div className={`relative h-32 overflow-hidden bg-linear-to-br ${visual.art}`}>
        <span className="absolute -left-8 -top-10 h-32 w-32 rounded-full bg-white/10" />
        <Icon name={visual.icon} className="absolute -bottom-5 -right-4 h-36 w-36 text-white/15" strokeWidth={1.2} />
        <span className="absolute bottom-3 left-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 text-white shadow-inner ring-1 ring-white/40 backdrop-blur-sm">
          <Icon name={visual.icon} className="h-9 w-9 drop-shadow-sm" strokeWidth={1.7} />
        </span>

        <span className="absolute left-3 top-3 inline-flex max-w-[70%] items-center gap-1.5 truncate rounded-lg bg-slate-900/70 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm">
          {categoryName}
        </span>
        <span className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-700 shadow-md">
          <Icon name="chevronRight" className="h-5 w-5" strokeWidth={2.5} />
        </span>

        <span className="absolute bottom-3 right-4 flex gap-1.5" aria-hidden="true">
          {Array.from({ length: DOTS }, (_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all ${i < filled ? 'w-4 bg-white' : 'w-1.5 bg-white/50'}`} />
          ))}
        </span>
      </div>

      <div className="px-4 pb-4 pt-3.5">
        <div className="flex items-start justify-between gap-3">
          <p className="min-w-0 flex-1 truncate text-xl font-bold leading-tight text-slate-900">{problem.title}</p>
          {eta.state === 'by' && (
            <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg bg-green-600 px-2 py-1 text-sm font-bold text-white">
              <Icon name="clock" className="h-3.5 w-3.5" strokeWidth={2.5} />
              {formatLeft(t, eta.minutes)}
            </span>
          )}
          {eta.state === 'late' && (
            <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg bg-orange-500 px-2 py-1 text-sm font-bold text-white">
              <Icon name="clock" className="h-3.5 w-3.5" strokeWidth={2.5} />
              {t('eta.lateShort')}
            </span>
          )}
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-slate-500">
          <span className={`inline-flex items-center gap-1.5 font-semibold ${style.text}`}>
            <Icon name={style.icon} className="h-4 w-4" />
            {t(`sstage.${stage}`)}
          </span>
          {eta.state === 'by' && (
            <>
              <span aria-hidden="true" className="h-4 w-px bg-slate-300" />
              <span>{t('eta.by', { when: formatWhen(eta.at, language) })}</span>
            </>
          )}
        </div>

        <div className={`mt-3 flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold ${confirm ? 'bg-brand-50 text-brand-800' : 'bg-slate-50 text-slate-700'}`}>
          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white ${confirm ? 'bg-brand-600' : 'bg-blue-600'}`}>
            <Icon name={confirm ? 'check' : 'user'} className="h-3.5 w-3.5" strokeWidth={2.5} />
          </span>
          <span className="min-w-0 truncate">{stripText}</span>
        </div>
      </div>
    </Link>
  );
}
