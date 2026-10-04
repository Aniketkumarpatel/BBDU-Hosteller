import Modal from './Modal.jsx';

export default function ConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  danger = true,
  loading = false,
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="max-w-md">
      <div className="text-xs text-slate-600 leading-relaxed">{message}</div>

      <div className="mt-6 flex justify-end gap-2.5">
        <button
          type="button"
          disabled={loading}
          onClick={onClose}
          className="rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {cancelText}
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={onConfirm}
          className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs disabled:opacity-50 ${
            danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-indigo-600 hover:bg-indigo-700'
          }`}
        >
          {loading && (
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
          )}
          {confirmText}
        </button>
      </div>
    </Modal>
  );
}
