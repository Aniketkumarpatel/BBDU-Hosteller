import { useState } from 'react';
import BottomSheet from '../common/BottomSheet.jsx';
import { useLanguage } from '../../i18n/LanguageContext.jsx';

const PRIORITIES = ['NORMAL', 'IMPORTANT', 'URGENT'];

/**
 * Post a notice to the students of a mess: a short title, the message, and how important it is.
 * Posting sends a notification to every student of that hostel, and the sheet says so.
 *
 * @param {{ onSubmit: (input: { title: string, message: string, priority: string }) => Promise<void>, onClose: () => void }} props
 */
export default function NoticeSheet({ onSubmit, onClose }) {
  const { t } = useLanguage();
  const [form, setForm] = useState({ title: '', message: '', priority: 'NORMAL' });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const send = async (e) => {
    e.preventDefault();
    const title = form.title.trim();
    const message = form.message.trim();
    if (!title || !message) {
      setError(t('mess.notice.err'));
      return;
    }
    setSending(true);
    setError('');
    try {
      await onSubmit({ title, message, priority: form.priority });
    } catch (err) {
      setError(err.message || t('mess.notice.err'));
      setSending(false);
    }
  };

  const field = 'mt-1.5 w-full rounded-2xl border-2 border-slate-200 px-3.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-hidden focus:ring-4 focus:ring-brand-100';

  return (
    <BottomSheet title={t('mess.notice.post')} onClose={onClose}>
      <form onSubmit={send} className="space-y-4">
        <div>
          <label htmlFor="notice-title" className="text-sm font-semibold text-slate-600">
            {t('mess.notice.title')}
          </label>
          <input id="notice-title" maxLength={120} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={`${field} h-12`} />
        </div>
        <div>
          <label htmlFor="notice-message" className="text-sm font-semibold text-slate-600">
            {t('mess.notice.message')}
          </label>
          <textarea id="notice-message" rows={4} maxLength={1000} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className={`${field} p-3`} />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-600">{t('mess.notice.priority')}</p>
          <div className="mt-1.5 flex gap-2" role="radiogroup" aria-label={t('mess.notice.priority')}>
            {PRIORITIES.map((value) => {
              const on = form.priority === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setForm({ ...form, priority: value })}
                  className={`h-12 flex-1 rounded-2xl text-base font-bold transition ${on ? 'bg-brand-600 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200'}`}
                >
                  {t(`mess.priority.${value}`)}
                </button>
              );
            })}
          </div>
        </div>

        <p className="text-sm text-slate-500">{t('mess.notice.broadcast')}</p>

        {error && (
          <p role="alert" className="rounded-2xl bg-brand-50 p-3 text-base font-medium text-brand-800 ring-1 ring-brand-200">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={sending}
          className="flex h-14 w-full items-center justify-center rounded-2xl bg-brand-600 text-lg font-bold text-white shadow-[0_8px_18px_-8px_rgba(200,42,65,0.7)] transition hover:bg-brand-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-brand-300 disabled:shadow-none"
        >
          {t('mess.notice.send')}
        </button>
      </form>
    </BottomSheet>
  );
}
