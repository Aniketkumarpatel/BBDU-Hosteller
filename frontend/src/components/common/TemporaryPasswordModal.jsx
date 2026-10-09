import { useState } from 'react';
import Modal from './Modal.jsx';

/**
 * Shows a one-time temporary password after a reset (DEC-022). The server returns it
 * exactly once, so this dialog is the only place it can ever be read. It is kept in
 * component state only: never stored, logged, or placed in a URL.
 */
export default function TemporaryPasswordModal({ isOpen, onClose, userName, userEmail, temporaryPassword }) {
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
      title="Temporary password created"
      subtitle={userName ? `${userName}${userEmail ? ` (${userEmail})` : ''}` : undefined}
      maxWidth="max-w-md"
    >
      <div className="space-y-4 text-xs text-slate-600">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800">
          This password is shown <strong>only once</strong>. Give it to the user in person or by a
          private message. They will be asked to choose their own password at their next sign in,
          and any session they currently have is signed out.
        </div>

        <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-300 bg-slate-50 px-3 py-3">
          <code data-testid="temporary-password" className="select-all break-all font-mono text-base font-bold tracking-wider text-slate-900">
            {temporaryPassword}
          </code>
          <button
            type="button"
            onClick={handleCopy}
            className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700"
          >
            I have shared it
          </button>
        </div>
      </div>
    </Modal>
  );
}
