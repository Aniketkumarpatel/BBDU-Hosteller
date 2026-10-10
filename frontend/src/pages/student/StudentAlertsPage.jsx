import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import Icon from '../../components/jobs/icons.jsx';
import { getMyNotifications, markAllNotificationsAsRead, markNotificationAsRead } from '../../services/notificationService.js';
import { describeNotification, formatAgo, getNotificationRoute } from '../../utils/notificationPresentation.js';

const TONE_STYLE = {
  alert: 'bg-orange-100 text-orange-700',
  warn: 'bg-amber-100 text-amber-800',
  redo: 'bg-orange-100 text-orange-700',
  good: 'bg-green-100 text-green-700',
  info: 'bg-brand-50 text-brand-600',
};

/** The student's notifications as a full screen (the Alerts tab), in plain language. */
export default function StudentAlertsPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { setUnread, refreshUnread } = useOutletContext();
  const role = user?.role;

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const res = await getMyNotifications({ limit: 30 });
      if (!res?.success) throw new Error('load failed');
      setItems(res.data.notifications || []);
      setUnread(res.data.unreadCount || 0);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [setUnread]);

  useEffect(() => {
    load();
  }, [load]);

  const unread = items.filter((n) => !n.isRead).length;

  const open = (item) => {
    if (!item.isRead) {
      setItems((current) => current.map((n) => (n._id === item._id ? { ...n, isRead: true } : n)));
      markNotificationAsRead(item._id).then(refreshUnread, refreshUnread);
    }
    const route = getNotificationRoute(role, item);
    if (route) navigate(route);
  };

  const markAll = async () => {
    setItems((current) => current.map((n) => ({ ...n, isRead: true })));
    setUnread(0);
    try {
      await markAllNotificationsAsRead();
    } catch {
      load();
    }
  };

  return (
    <div className="space-y-4 px-4 pt-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">{t('notif.title')}</h1>
        {unread > 0 && (
          <button type="button" onClick={markAll} className="h-11 rounded-full bg-brand-50 px-4 text-sm font-bold text-brand-700">
            {t('notif.markAll')}
          </button>
        )}
      </div>

      {loading && items.length === 0 ? (
        <div className="space-y-3" aria-busy="true" aria-label={t('common.loading')}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-3xl bg-slate-100" />
          ))}
        </div>
      ) : failed && items.length === 0 ? (
        <div role="alert" className="rounded-3xl border border-brand-200 bg-brand-50 p-5 text-center">
          <p className="text-base font-semibold text-brand-800">{t('error.load')}</p>
          <button type="button" onClick={load} className="mt-3 h-12 rounded-2xl bg-brand-600 px-6 text-base font-bold text-white">
            {t('common.retry')}
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
          <Icon name="bell" className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 text-lg font-bold text-slate-700">{t('notif.empty')}</p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {items.map((item) => {
            const view = describeNotification(item, role, t);
            return (
              <li key={item._id}>
                <button
                  type="button"
                  onClick={() => open(item)}
                  className={`flex w-full items-start gap-3 rounded-3xl border p-4 text-left transition active:scale-[0.99] ${
                    item.isRead ? 'border-slate-200 bg-white' : 'border-brand-200 bg-brand-50/50'
                  }`}
                >
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${TONE_STYLE[view.tone]}`}>
                    <Icon name={view.icon} className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-base leading-snug text-slate-900 ${item.isRead ? 'font-medium' : 'font-bold'}`}>{view.title}</span>
                    {view.body && <span className="mt-0.5 block break-words text-sm text-slate-600">{view.body}</span>}
                    <span className="mt-1 block text-sm text-slate-400">{formatAgo(t, item.createdAt)}</span>
                  </span>
                  {!item.isRead && <span aria-hidden="true" className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-brand-600" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
