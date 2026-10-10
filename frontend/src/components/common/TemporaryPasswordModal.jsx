import { useState } from 'react';
import Modal from './Modal.jsx';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

/**
 * Shows a one-time temporary password after a reset (DEC-022). The server returns it
 * exactly once, so this dialog is the only place it can ever be read. It is kept in
 * component state only: never stored, logged, or placed in a URL. Wording follows the
 * chosen language (English by default, so the admin console is unchanged).
 */
export default function TemporaryPasswordModal({ isOpen, onClose, userName, userEmail, temporaryPassword }) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(temporaryPassword);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const handleClose = () => {
    setCopied(false);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t('temp.title')}
      subtitle={userName ? `${userName}${userEmail ? ` (${userEmail})` : ''}` : undefined}
      maxWidth="max-w-md"
    >
      <div className="space-y-4 text-sm text-slate-600">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800">{t('temp.warning')}</div>

        <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-300 bg-slate-50 px-3 py-3">
          <code data-testid="temporary-password" className="select-all break-all font-mono text-lg font-bold tracking-wider text-slate-900">
            {temporaryPassword}
          </code>
          <button
            type="button"
            onClick={handleCopy}
            className="h-11 shrink-0 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            {copied ? t('temp.copied') : t('temp.copy')}
          </button>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleClose}
            className="h-12 rounded-lg bg-indigo-600 px-5 text-base font-semibold text-white shadow-xs hover:bg-indigo-700"
          >
            {t('temp.done')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
