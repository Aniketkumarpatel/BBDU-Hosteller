import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { IS_PILOT_MODE } from '../../config/pilot.js';
import {
  getMyNotifications,
  getUnreadCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
} from '../../services/notificationService.js';

function formatRelativeTime(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffSec = Math.floor((now - date) / 1000);

  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function getNotificationStyle(type) {
  switch (type) {
    case 'COMPLAINT_ESCALATED':
    case 'COMPLAINT_SLA_BREACHED':
      return {
        badgeBg: 'bg-rose-50 text-rose-700 ring-rose-200',
        dotBg: 'bg-rose-500',
        icon: (
          <svg className="h-4 w-4 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        ),
      };
    case 'COMPLAINT_SLA_WARNING':
      return {
        badgeBg: 'bg-amber-50 text-amber-700 ring-amber-200',
        dotBg: 'bg-amber-500',
        icon: (
          <svg className="h-4 w-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
      };
    case 'COMPLAINT_RESOLVED':
    case 'COMPLAINT_ACKNOWLEDGED':
      return {
        badgeBg: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
        dotBg: 'bg-emerald-500',
        icon: (
          <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
      };
    case 'COMPLAINT_REOPENED':
      return {
        badgeBg: 'bg-orange-50 text-orange-700 ring-orange-200',
        dotBg: 'bg-orange-500',
        icon: (
          <svg className="h-4 w-4 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        ),
      };
    case 'COMPLAINT_ASSIGNED':
      return {
        badgeBg: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
        dotBg: 'bg-indigo-500',
        icon: (
          <svg className="h-4 w-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        ),
      };
    default:
      return {
        badgeBg: 'bg-blue-50 text-blue-700 ring-blue-200',
        dotBg: 'bg-blue-500',
        icon: (
          <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
      };
  }
}

export default function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterUnread, setFilterUnread] = useState(false);
  const dropdownRef = useRef(null);

  // Helper to resolve complaint detail route based on user role
  const getComplaintRoute = useCallback((complaintId) => {
    if (!complaintId) return null;
    const role = user?.role;
    if (role === 'STUDENT') return `/student/complaints/${complaintId}`;
    if (role === 'WARDEN') return IS_PILOT_MODE ? `/warden/problems/${complaintId}` : `/warden/complaints/${complaintId}`;
    if (role === 'HOSTEL_STAFF') return IS_PILOT_MODE ? `/staff/jobs/${complaintId}` : `/staff/complaints/${complaintId}`;
    if (role === 'AUTHORITY') return `/authority/complaints/${complaintId}`;
    if (role === 'SUPER_ADMIN') return `/warden/complaints/${complaintId}`;
    return null;
  }, [user?.role]);

  // Fetch unread count lightweight polling
  const fetchCount = useCallback(async () => {
    try {
      const res = await getUnreadCount();
      if (res?.success) {
        setUnreadCount(res.data.unreadCount || 0);
      }
    } catch {
      // Gracefully handle silent network blips
    }
  }, []);

  // Fetch full notification list
  const fetchList = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getMyNotifications({ limit: 30, unreadOnly: filterUnread });
      if (res?.success) {
        setNotifications(res.data.notifications || []);
        setUnreadCount(res.data.unreadCount || 0);
      }
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [filterUnread]);

  // Initial fetch and 20s interval polling
  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 20000);

    const onFocus = () => fetchCount();
    window.addEventListener('focus', onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [fetchCount]);

  // Re-fetch list when dropdown opens or filter toggles
  useEffect(() => {
    if (isOpen) {
      fetchList();
    }
  }, [isOpen, fetchList]);

  // Close dropdown on outside click or Esc
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleMarkAsRead = async (notif, e) => {
    if (e) e.stopPropagation();
    if (notif.isRead) return;

    // Optimistic UI update
    setNotifications((prev) =>
      prev.map((item) => (item._id === notif._id ? { ...item, isRead: true } : item))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    try {
      await markNotificationAsRead(notif._id);
    } catch {
      fetchCount();
    }
  };

  const handleMarkAllRead = async () => {
    if (unreadCount === 0) return;

    // Optimistic UI update
    setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
    setUnreadCount(0);

    try {
      await markAllNotificationsAsRead();
    } catch {
      fetchCount();
    }
  };

  const handleDelete = async (notifId, e) => {
    if (e) e.stopPropagation();

    // Optimistic delete
    setNotifications((prev) => prev.filter((item) => item._id !== notifId));
    try {
      await deleteNotification(notifId);
      fetchCount();
    } catch {
      fetchList();
    }
  };

  const handleNotificationClick = async (notif) => {
    if (!notif.isRead) {
      await handleMarkAsRead(notif);
    }
    setIsOpen(false);

    // Navigate to related complaint if exists
    const targetEntityId = notif.relatedEntityId?._id || notif.relatedEntityId;
    if (targetEntityId) {
      const route = getComplaintRoute(targetEntityId);
      if (route) {
        navigate(route);
      }
    }
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="View notifications"
        className={`relative rounded-lg p-2 transition focus:outline-hidden ${
          isOpen
            ? 'bg-slate-200/80 text-slate-900'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        }`}
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.8}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white shadow-xs animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-slate-200 bg-white shadow-xl ring-1 ring-black/5 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-900">Notifications</span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFilterUnread((prev) => !prev)}
                className={`text-[11px] font-medium rounded px-1.5 py-0.5 transition ${
                  filterUnread ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {filterUnread ? 'Unread only' : 'All'}
              </button>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
                >
                  Mark all read
                </button>
              )}
            </div>
          </div>

          {/* List Content */}
          <div className="max-h-[22rem] overflow-y-auto divide-y divide-slate-100">
            {loading && notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent mb-2" />
                <span className="text-xs">Loading notifications...</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                </div>
                <p className="text-xs font-medium text-slate-700">No notifications found</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {filterUnread ? 'You have caught up with all updates!' : 'Activity updates will appear here.'}
                </p>
              </div>
            ) : (
              notifications.map((item) => {
                const style = getNotificationStyle(item.type);
                return (
                  <div
                    key={item._id}
                    onClick={() => handleNotificationClick(item)}
                    className={`group relative flex items-start gap-3 p-3.5 transition cursor-pointer hover:bg-slate-50/80 ${
                      !item.isRead ? 'bg-indigo-50/30' : 'bg-white'
                    }`}
                  >
                    {/* Icon indicator */}
                    <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ring-1 ${style.badgeBg}`}>
                      {style.icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pr-4">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs font-semibold truncate ${!item.isRead ? 'text-slate-900' : 'text-slate-700'}`}>
                          {item.title}
                        </span>
                        {!item.isRead && (
                          <span className={`h-1.5 w-1.5 rounded-full ${style.dotBg} shrink-0`} />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600 line-clamp-2 mt-0.5 leading-snug">
                        {item.message}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-slate-400">
                          {formatRelativeTime(item.createdAt)}
                        </span>
                        {item.metadata?.complaintId && (
                          <span className="text-[10px] font-medium text-indigo-600">
                            #{item.metadata.complaintId}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!item.isRead && (
                        <button
                          type="button"
                          title="Mark as read"
                          onClick={(e) => handleMarkAsRead(item, e)}
                          className="rounded p-1 text-slate-400 hover:bg-slate-200/60 hover:text-indigo-600"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                      )}
                      <button
                        type="button"
                        title="Delete notification"
                        onClick={(e) => handleDelete(item._id, e)}
                        className="rounded p-1 text-slate-400 hover:bg-slate-200/60 hover:text-rose-600"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-2 text-center text-[11px] text-slate-400">
            Real-time in-app notification center
          </div>
        </div>
      )}
    </div>
  );
}
