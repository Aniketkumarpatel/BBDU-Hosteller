import Icon from './icons.jsx';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { getDueInfo } from '../../utils/jobPresentation.js';
import { describeDue } from '../../utils/jobFormat.js';

const TONE = {
  late: 'text-rose-700 bg-rose-50',
  soon: 'text-amber-800 bg-amber-50',
  ok: 'text-slate-600 bg-slate-50',
};

/** "Late by 2 hr" / "Hurry, due in 3 hr" / "Due in 2 days". Renders nothing when no deadline applies. */
export default function DueLine({ job }) {
  const { t } = useLanguage();
  const info = getDueInfo(job);
  if (info.state === 'none') return null;

  return (
    <p className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm font-semibold ${TONE[info.state]}`}>
      <Icon name={info.state === 'late' ? 'alert' : 'clock'} className="h-4 w-4" />
      {describeDue(t, info)}
    </p>
  );
}
