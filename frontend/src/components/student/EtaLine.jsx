import Icon from '../jobs/icons.jsx';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { getEta } from '../../utils/studentPresentation.js';
import { formatLeft, formatWhen } from '../../utils/studentFormat.js';

/**
 * The promise: "Fix by 5:00 PM, 2 hr left". When it runs over, a gentle line that says the
 * warden knows, never a harsh "late" at the student.
 */
export default function EtaLine({ problem, className = '' }) {
  const { t, language } = useLanguage();
  const eta = getEta(problem);
  if (eta.state === 'none') return null;

  if (eta.state === 'late') {
    return (
      <p className={`flex items-start gap-2 text-sm font-medium text-orange-800 ${className}`}>
        <Icon name="clock" className="mt-0.5 h-4 w-4 shrink-0" />
        {t('eta.late')}
      </p>
    );
  }
  return (
    <p className={`flex items-center gap-2 text-sm text-slate-600 ${className}`}>
      <Icon name="clock" className="h-4 w-4 shrink-0 text-slate-400" />
      <span className="font-semibold text-slate-900">{t('eta.by', { when: formatWhen(eta.at, language) })}</span>
      <span aria-hidden="true">{'·'}</span>
      <span>{t('eta.left', { time: formatLeft(t, eta.minutes) })}</span>
    </p>
  );
}
