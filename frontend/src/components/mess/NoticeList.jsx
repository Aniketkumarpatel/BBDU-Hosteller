import { useLanguage } from '../../i18n/LanguageContext.jsx';
import { sortNotices } from '../../utils/messPresentation.js';

const TONE = {
  URGENT: 'bg-brand-50 ring-brand-200 text-brand-900',
  IMPORTANT: 'bg-amber-50 ring-amber-200 text-amber-900',
  NORMAL: 'bg-slate-50 ring-slate-200 text-slate-900',
};

/**
 * Notices of the mess, urgent first. Students only read them. When `onToggle` is given (managers)
 * each notice also has a switch to turn it off or on, and switched-off notices are marked.
 *
 * @param {{ notices: object[], onToggle?: (notice: object) => void, busyId?: string }} props
 */
export default function NoticeList({ notices, onToggle, busyId = '' }) {
  const { t } = useLanguage();
  const list = sortNotices(notices);
  if (list.length === 0) return null;

  return (
    <ul className="space-y-2.5">
      {list.map((notice) => (
        <li key={notice._id} className={`rounded-2xl p-4 ring-1 ${TONE[notice.priority] || TONE.NORMAL} ${notice.isActive === false ? 'opacity-60' : ''}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-base font-bold leading-snug">
                {notice.title}
                {notice.isActive === false && <span className="ml-2 rounded-full bg-white/80 px-2 py-0.5 text-xs font-bold text-slate-600">{t('mess.notice.inactive')}</span>}
              </p>
              <p className="mt-1 whitespace-pre-line break-words text-base">{notice.message}</p>
            </div>
            {onToggle && (
              <button
                type="button"
                disabled={busyId === notice._id}
                onClick={() => onToggle(notice)}
                className="h-11 shrink-0 rounded-full bg-white px-4 text-sm font-bold text-slate-700 ring-1 ring-slate-200 disabled:opacity-60"
              >
                {notice.isActive === false ? t('mess.notice.on') : t('mess.notice.off')}
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
