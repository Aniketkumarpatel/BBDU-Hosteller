import { Link, useNavigate } from 'react-router-dom';
import StageChip from './StageChip.jsx';
import DueLine from './DueLine.jsx';
import { ACTION_STYLE, PRIORITY_STYLE, STAGE_STYLE } from './stageStyle.js';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { getLocation, getNextAction, getStage } from '../../utils/jobPresentation.js';
import { describeBlock } from '../../utils/jobFormat.js';

/**
 * One job on the "My jobs" list. The room is the biggest thing on the card because it
 * is the first thing a technician needs. One big button does the next step; finishing
 * a job needs a note, so that button opens the job screen with the note sheet ready.
 */
export default function JobCard({ job, busy, onAction }) {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const stage = getStage(job);
  const action = getNextAction(job);
  const { room, block } = getLocation(job);
  const style = STAGE_STYLE[stage];
  const jobPath = `/staff/jobs/${job._id}`;

  const handleAction = () => {
    if (action === 'finish') {
      navigate(`${jobPath}?finish=1`);
    } else {
      onAction(action, job);
    }
  };

  return (
    <article className={`overflow-hidden rounded-2xl border border-slate-200 border-l-4 bg-white shadow-sm ${style.accent}`}>
      <Link
        to={jobPath}
        className="block p-4 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        <p className="whitespace-nowrap text-2xl font-bold leading-tight text-slate-900">
          {room ? t('job.room', { room }) : t('job.roomUnknown')}
          {block && <span className="ml-2 text-base font-medium text-slate-500">{describeBlock(t, block)}</span>}
        </p>
        <div className="mt-2">
          <StageChip stage={stage} />
        </div>

        <h3 className="mt-3 line-clamp-2 text-lg font-semibold leading-snug text-slate-800">{job.title}</h3>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {job.category && (
            <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-sm font-medium text-slate-700">
              {t(`category.${job.category}`)}
            </span>
          )}
          {job.priority && (
            <span className={`rounded-lg px-2.5 py-1 text-sm font-medium ${PRIORITY_STYLE[job.priority] || PRIORITY_STYLE.MEDIUM}`}>
              {t(`priority.${job.priority}`)}
            </span>
          )}
        </div>

        <div className="mt-3">
          <DueLine job={job} />
        </div>
      </Link>

      {action && (
        <div className="border-t border-slate-100 p-3">
          <button
            type="button"
            disabled={busy}
            onClick={handleAction}
            className={`h-14 w-full rounded-xl text-lg font-bold text-white shadow-sm transition disabled:opacity-60 ${ACTION_STYLE[action]}`}
          >
            {busy ? t('action.wait') : t(`action.${action}`)}
          </button>
        </div>
      )}
    </article>
  );
}
