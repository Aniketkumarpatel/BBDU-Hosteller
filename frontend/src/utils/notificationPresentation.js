/**
 * Pure rules that turn a stored notification into plain-language text for the pilot
 * screens (DEC-030). No React and no browser APIs, so it is unit tested with node:test.
 * The server keeps its English text as a fallback for any type not worded here.
 */
import { DICTIONARY } from '../i18n/dictionary.js';

const AUDIENCE_BY_ROLE = { WARDEN: 'warden', HOSTEL_STAFF: 'staff', STUDENT: 'student' };

// How each notification looks: a tone (colour) and an icon name from components/jobs/icons.jsx
const STYLE_BY_TYPE = {
  COMPLAINT_ASSIGNED: { tone: 'info', icon: 'inbox' },
  COMPLAINT_SUBMITTED: { tone: 'info', icon: 'inbox' },
  COMPLAINT_REOPENED: { tone: 'redo', icon: 'redo' },
  COMPLAINT_SLA_WARNING: { tone: 'warn', icon: 'clock' },
  COMPLAINT_SLA_BREACHED: { tone: 'alert', icon: 'alert' },
  COMPLAINT_ESCALATED: { tone: 'alert', icon: 'alert' },
  COMPLAINT_RESOLVED: { tone: 'good', icon: 'check' },
  COMPLAINT_ACKNOWLEDGED: { tone: 'good', icon: 'check' },
  COMPLAINT_STATUS_CHANGED: { tone: 'info', icon: 'tool' },
};
const DEFAULT_STYLE = { tone: 'info', icon: 'inbox' };

/** Notification types that have plain wording for a role, as `notif.<audience>.<TYPE>` keys. */
export const worded = (role, type) => {
  const audience = AUDIENCE_BY_ROLE[role];
  const key = audience ? `notif.${audience}.${type}` : '';
  return key && DICTIONARY.en[key] ? key : '';
};

/**
 * @param {{ type: string, title?: string, metadata?: { room?: string, title?: string } }} notification
 * @param {string} role the signed-in user's role
 * @param {(key: string, params?: object) => string} t translate function
 * @returns {{ title: string, body: string, tone: string, icon: string }}
 */
export const describeNotification = (notification, role, t) => {
  const key = worded(role, notification?.type);
  const meta = notification?.metadata || {};
  const body = [meta.room ? t('job.room', { room: meta.room }) : '', meta.title || ''].filter(Boolean).join(' · ');
  const style = STYLE_BY_TYPE[notification?.type] || DEFAULT_STYLE;
  return {
    title: key ? t(key) : notification?.title || '',
    body,
    tone: style.tone,
    icon: style.icon,
  };
};

/**
 * Where tapping a notification should go for this role, or null when there is nowhere.
 * Only complaint notifications link to a screen.
 */
export const getNotificationRoute = (role, notification) => {
  if (notification?.relatedEntityType && notification.relatedEntityType !== 'COMPLAINT') return null;
  const id = notification?.relatedEntityId?._id || notification?.relatedEntityId;
  if (!id) return null;
  if (role === 'HOSTEL_STAFF') return `/staff/jobs/${id}`;
  if (role === 'WARDEN') return `/warden/problems/${id}`;
  if (role === 'STUDENT') return `/student/problems/${id}`;
  return null;
};

/**
 * "Just now", "5 min ago", "3 hr ago", "Yesterday", "4 days ago".
 * @param {(key: string, params?: object) => string} t translate function
 */
export const formatAgo = (t, dateString, now = new Date()) => {
  if (!dateString) return '';
  const seconds = Math.floor((now - new Date(dateString)) / 1000);
  if (Number.isNaN(seconds) || seconds < 60) return t('notif.ago.now');
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return t('notif.ago.minutes', { n: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('notif.ago.hours', { n: hours });
  const days = Math.floor(hours / 24);
  return days === 1 ? t('notif.ago.yesterday') : t('notif.ago.days', { n: days });
};
