import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLanguage } from '../../i18n/LanguageContext.jsx';
import Icon from '../jobs/icons.jsx';
import {
  getMyNotifications,
  getUnreadCount,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from '../../services/notificationService.js';
import { describeNotification, formatAgo, getNotificationRoute } from '../../utils/notificationPresentation.js';

const POLL_MS = 30000;

const TONE_STYLE = {
  alert: 'bg-rose-100 text-rose-700',
  warn: 'bg-amber-100 text-amber-800',
  redo: 'bg-orange-100 text-orange-700',
  good: 'bg-emerald-100 text-emerald-700',
  info: 'bg-brand-100 text-brand-700',
};

/**
 * Notification bell for the pilot screens (DEC-030): plain words in English or Hindi,
 * the room and problem instead of a ticket number, large tap targets, and one tap goes
 * straight to the job or problem. The panel is rendered outside the header so it is
 * never clipped and, on a phone, uses the full width.
 */
export default function PilotNotificationBell() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const role = user?.role;

  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const panelRef = useRef(null);
  const buttonRef = useRef(null);

  const fetchCount = useCallback(async () => {
    try {
      const res = await getUnreadCount();
      if (res?.success) setUnread(res.data.unreadCount || 0);
    } catch {
      /* a missed poll is fine, the next one will catch up */
    }
  }, []);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const res = await getMyNotifications({ limit: 20 });
      if (res?.success) {
        setItems(res.data.notifications || []);
        setUnread(res.data.unreadCount || 0);
      } else {
        setFailed(true);
      }
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCount();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') fetchCount();
    }, POLL_MS);
    window.addEventListener('focus', fetchCount);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', fetchCount);
    };
  }, [fetchCount]);

  useEffect(() => {
    if (open) fetchList();
  }, [open, fetchList]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (e) => {
      if (panelRef.current?.contains(e.target) || buttonRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handleItem = async (item) => {
    setOpen(false);
    if (!item.isRead) {
      setItems((current) => current.map((n) => (n._id === item._id ? { ...n, isRead: true } : n)));
      setUnread((count) => Math.max(0, count - 1));
      markNotificationAsRead(item._id).catch(fetchCount);
    }
    const route = getNotificationRoute(role, item);
    if (route) navigate(route);
  };

  const handleMarkAll = async () => {
    setItems((current) => current.map((n) => ({ ...n, isRead: true })));
    setUnread(0);
    try {
      await markAllNotificationsAsRead();
    } catch {
      fetchList();
    }
  };

  const panel = open && (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={t('notif.title')}
      className="fixed inset-x-3 top-[68px] z-50 flex max-h-[75vh] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:inset-x-auto sm:right-4 sm:w-[26rem]"
    >
      <div className="border-b border-slate-100 px-4 py-3">
        <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900">
          {t('notif.title')}
          {unread > 0 && (
            <span className="whitespace-nowrap rounded-full bg-brand-100 px-2.5 py-0.5 text-sm font-bold text-brand-700">{t('notif.new', { n: unread })}</span>
          )}
        </h2>
        {unread > 0 && (
          <button type="button" onClick={handleMarkAll} className="mt-2 h-11 w-full rounded-xl bg-brand-50 text-base font-bold text-brand-700 hover:bg-brand-100">
            {t('notif.markAll')}
          </button>
        )}
      </div>

      <div className="overflow-y-auto">
        {loading && items.length === 0 ? (
          <div className="space-y-2 p-4" aria-busy="true" aria-label={t('common.loading')}>
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : failed && items.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-base font-semibold text-rose-700">{t('error.load')}</p>
            <button type="button" onClick={fetchList} className="mt-3 h-11 rounded-xl bg-rose-600 px-5 text-base font-bold text-white">
              {t('common.retry')}
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center">
            <Icon name="inbox" className="mx-auto h-9 w-9 text-slate-300" />
            <p className="mt-2 text-lg font-semibold text-slate-600">{t('notif.empty')}</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((item) => {
              const view = describeNotification(item, role, t);
              return (
                <li key={item._id}>
                  <button
                    type="button"
                    onClick={() => handleItem(item)}
                    className={`flex w-full min-h-[4.5rem] items-start gap-3 px-4 py-3 text-left transition hover:bg-slate-50 ${item.isRead ? '' : 'bg-brand-50/60'}`}
                  >
                    <span className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${TONE_STYLE[view.tone]}`}>
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
    </div>
  );

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={t('notif.open')}
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100"
      >
        <svg aria-hidden="true" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-xs font-bold text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>
      {panel && createPortal(panel, document.body)}
    </>
  );
}
