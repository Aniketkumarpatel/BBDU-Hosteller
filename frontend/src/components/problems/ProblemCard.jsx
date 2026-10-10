import { Link } from 'react-router-dom';
import StageChip from '../jobs/StageChip.jsx';
import DueLine from '../jobs/DueLine.jsx';
import Icon from '../jobs/icons.jsx';
import { PRIORITY_STYLE, STAGE_STYLE } from '../jobs/stageStyle.js';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { getLocation } from '../../utils/jobPresentation.js';
import { describeBlock } from '../../utils/jobFormat.js';
import { canChangeTechnician, canGiveToTechnician, getWardenBucket, getWardenStage } from '../../utils/problemPresentation.js';

/**
 * One problem on the Warden's list. Same shape as the technician's job card so both
 * roles read the same way: room first, then status, then what is wrong. The big button
 * only appears when the Warden has something to do: giving a new problem to a technician.
 */
export default function ProblemCard({ problem, onGive }) {
  const { t } = useLanguage();
  const stage = getWardenStage(problem);
  const style = STAGE_STYLE[stage];
  const { room, block } = getLocation(problem);
  const path = `/warden/problems/${problem._id}`;
  const holder = problem.assignedTo?.name;
  const giveable = canGiveToTechnician(problem);
  // Changing the technician is offered here only for late problems; otherwise it lives on the problem page
  const changeable = canChangeTechnician(problem) && getWardenBucket(problem) === 'late';

  return (
    <article className={`overflow-hidden rounded-2xl border border-slate-200 border-l-4 bg-white shadow-sm ${style?.accent || ''}`}>
      <Link to={path} className="block p-4 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500">
        <p className="whitespace-nowrap text-2xl font-bold leading-tight text-slate-900">
          {room ? t('job.room', { room }) : t('job.roomUnknown')}
          {block && <span className="ml-2 text-base font-medium text-slate-500">{describeBlock(t, block)}</span>}
        </p>
        <div className="mt-2">
          <StageChip stage={stage} perspective="warden" />
        </div>

        <h3 className="mt-3 line-clamp-2 text-lg font-semibold leading-snug text-slate-800">{problem.title}</h3>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {problem.category && (
            <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-sm font-medium text-slate-700">{t(`category.${problem.category}`)}</span>
          )}
          {problem.priority && (
            <span className={`rounded-lg px-2.5 py-1 text-sm font-medium ${PRIORITY_STYLE[problem.priority] || PRIORITY_STYLE.MEDIUM}`}>
              {t(`priority.${problem.priority}`)}
            </span>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <DueLine job={problem} />
          <p className="flex items-center gap-1.5 text-base text-slate-600">
            <Icon name="tool" className="h-4 w-4 text-slate-400" />
            {holder ? t('problem.with', { name: holder }) : t('problem.nobody')}
          </p>
        </div>
      </Link>

      {(giveable || changeable) && onGive && (
        <div className="border-t border-slate-100 p-3">
          <button
            type="button"
            onClick={() => onGive(problem)}
            className={`h-14 w-full rounded-xl text-lg font-bold shadow-sm transition ${
              giveable
                ? 'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800'
                : 'border-2 border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {giveable ? t('problem.give') : t('problem.change')}
          </button>
        </div>
      )}
    </article>
  );
}
