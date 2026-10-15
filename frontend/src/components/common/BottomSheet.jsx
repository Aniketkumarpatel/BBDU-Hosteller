import { useEffect } from 'react';
import Icon from '../jobs/icons.jsx';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

/**
 * A sheet that slides up from the bottom on a phone and sits in the middle on a wide screen.
 * Closes with the X, a tap on the dimmed area or the Escape key; the page behind does not scroll.
 */
export default function BottomSheet({ title, onClose, children }) {
  const { t } = useLanguage();

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label={t('common.close')} onClick={onClose} className="absolute inset-0 cursor-default bg-slate-900/50" tabIndex={-1} />
      <div className="relative max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 pb-7 shadow-2xl sm:rounded-3xl">
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-200 sm:hidden" />
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-2xl font-extrabold leading-tight text-slate-900">{title}</h2>
          <button type="button" onClick={onClose} aria-label={t('common.close')} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
            <Icon name="close" className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}
