import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DICTIONARY, translate } from '../src/i18n/dictionary.js';
import { describeNotification, formatAgo, getNotificationRoute, worded } from '../src/utils/notificationPresentation.js';
import { NOTIFICATION_TYPE_VALUES } from '../../backend/src/constants/notification.constants.js';

const en = (key, params) => translate('en', key, params);
const hi = (key, params) => translate('hi', key, params);

test('every notification type that is worded for a role really exists in the backend', () => {
  const worded = Object.keys(DICTIONARY.en)
    .filter((key) => /^notif\.(staff|warden|student)\./.test(key))
    .map((key) => key.split('.')[2]);
  assert.ok(worded.length > 0);
  for (const type of worded) {
    assert.ok(NOTIFICATION_TYPE_VALUES.includes(type), `${type} is not a backend notification type`);
  }
});

test('technician and Warden notifications use plain words in both languages', () => {
  const staffAssigned = { type: 'COMPLAINT_ASSIGNED', title: 'New Complaint Assigned', metadata: { room: '102', title: 'Tap leaking' } };
  assert.deepEqual(describeNotification(staffAssigned, 'HOSTEL_STAFF', en), {
    title: 'New job for you',
    body: 'Room 102 · Tap leaking',
    tone: 'info',
    icon: 'inbox',
  });
  assert.equal(describeNotification(staffAssigned, 'HOSTEL_STAFF', hi).title, 'आपके लिए नया काम');
  assert.equal(describeNotification(staffAssigned, 'HOSTEL_STAFF', hi).body, 'कमरा 102 · Tap leaking');

  const breached = { type: 'COMPLAINT_SLA_BREACHED', title: 'SLA Breached: Action Needed', metadata: {} };
  assert.equal(describeNotification(breached, 'WARDEN', en).title, 'A job is late');
  assert.equal(describeNotification(breached, 'WARDEN', en).tone, 'alert');
  assert.equal(describeNotification(breached, 'HOSTEL_STAFF', en).title, 'This job is late');
});

test('the same type reads from the right side for each role', () => {
  const reopened = { type: 'COMPLAINT_REOPENED', title: 'x', metadata: {} };
  assert.equal(describeNotification(reopened, 'WARDEN', en).tone, 'redo');
  assert.equal(worded('WARDEN', 'COMPLAINT_SUBMITTED') !== '', true);
  assert.equal(worded('HOSTEL_STAFF', 'COMPLAINT_SUBMITTED'), '', 'a technician is never told about new submissions');
});

test('unknown types, other roles and missing context fall back safely', () => {
  const unknown = { type: 'MESS_MENU_PUBLISHED', title: 'Menu published', metadata: {} };
  assert.deepEqual(describeNotification(unknown, 'WARDEN', en), { title: 'Menu published', body: '', tone: 'info', icon: 'inbox' });
  const resolved = { type: 'COMPLAINT_RESOLVED', title: 'Fixed', metadata: { room: '5', title: 'Fan' } };
  assert.equal(describeNotification(resolved, 'STUDENT', en).title, 'Is it fixed? Please check');
  assert.equal(describeNotification(resolved, 'AUTHORITY', en).title, 'Fixed', 'roles without plain wording keep the server text');
  assert.equal(describeNotification({ type: 'COMPLAINT_ASSIGNED', title: 'T' }, 'HOSTEL_STAFF', en).body, '');
  assert.deepEqual(describeNotification(null, 'WARDEN', en), { title: '', body: '', tone: 'info', icon: 'inbox' });
  const onlyTitle = { type: 'COMPLAINT_ASSIGNED', title: 'T', metadata: { title: 'Tap leaking' } };
  assert.equal(describeNotification(onlyTitle, 'HOSTEL_STAFF', en).body, 'Tap leaking');
});

test('tapping goes to the right screen for the role', () => {
  const n = { relatedEntityType: 'COMPLAINT', relatedEntityId: 'abc123' };
  assert.equal(getNotificationRoute('HOSTEL_STAFF', n), '/staff/jobs/abc123');
  assert.equal(getNotificationRoute('WARDEN', n), '/warden/problems/abc123');
  assert.equal(getNotificationRoute('WARDEN', { relatedEntityId: { _id: 'xyz' } }), '/warden/problems/xyz');
  assert.equal(getNotificationRoute('STUDENT', n), '/student/problems/abc123');
  assert.equal(getNotificationRoute('SUPER_ADMIN', n), null);
  assert.equal(getNotificationRoute('WARDEN', { relatedEntityType: 'MESS', relatedEntityId: 'm1' }), null);
  assert.equal(getNotificationRoute('WARDEN', { relatedEntityType: 'COMPLAINT', relatedEntityId: null }), null);
});

test('time since reads naturally in both languages', () => {
  const now = new Date('2026-10-10T12:00:00Z');
  const ago = (ms) => new Date(now.getTime() - ms).toISOString();
  assert.equal(formatAgo(en, ago(20 * 1000), now), 'Just now');
  assert.equal(formatAgo(en, ago(5 * 60000), now), '5 min ago');
  assert.equal(formatAgo(en, ago(3 * 3600000), now), '3 hr ago');
  assert.equal(formatAgo(en, ago(30 * 3600000), now), 'Yesterday');
  assert.equal(formatAgo(en, ago(4 * 86400000), now), '4 days ago');
  assert.equal(formatAgo(hi, ago(5 * 60000), now), '5 मिनट पहले');
  assert.equal(formatAgo(hi, ago(3 * 3600000), now), '3 घंटे पहले');
  assert.equal(formatAgo(en, '', now), '');
  assert.equal(formatAgo(en, 'not a date', now), 'Just now');
});
