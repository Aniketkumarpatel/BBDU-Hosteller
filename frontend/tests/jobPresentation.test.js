import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getStage,
  getNextAction,
  getDueInfo,
  splitDuration,
  compareJobs,
  groupJobs,
  countActionable,
  getProgressSteps,
  getLocation,
  STAGE_ORDER,
} from '../src/utils/jobPresentation.js';
import { COMPLAINT_STATUS_VALUES } from '../../backend/src/constants/complaint.constants.js';

const NOW = new Date('2026-10-10T10:00:00Z');
const minutesFromNow = (m) => new Date(NOW.getTime() + m * 60000).toISOString();
const job = (overrides = {}) => ({
  _id: Math.random().toString(36).slice(2),
  status: 'ASSIGNED',
  priority: 'MEDIUM',
  slaStatus: 'ACTIVE',
  slaDueAt: minutesFromNow(600),
  createdAt: minutesFromNow(-60),
  ...overrides,
});

test('every status maps to a stage or is deliberately ignored', () => {
  const ignored = [];
  for (const status of COMPLAINT_STATUS_VALUES) {
    if (getStage({ status }) === null) ignored.push(status);
  }
  // Statuses a technician never works on: before assignment, parked, escalated, rejected
  assert.deepEqual(
    ignored.sort(),
    ['ESCALATED', 'REJECTED', 'SUBMITTED', 'TRIAGED', 'WAITING_FOR_INFORMATION'].sort()
  );
});

test('the next action follows the real workflow: got it, start, finish, start again', () => {
  assert.equal(getNextAction({ status: 'ASSIGNED' }), 'acknowledge');
  assert.equal(getNextAction({ status: 'ACKNOWLEDGED' }), 'start');
  assert.equal(getNextAction({ status: 'IN_PROGRESS' }), 'finish');
  assert.equal(getNextAction({ status: 'REOPENED' }), 'resume');
  assert.equal(getNextAction({ status: 'STUDENT_VERIFICATION' }), null);
  assert.equal(getNextAction({ status: 'CLOSED' }), null);
  assert.equal(getNextAction({ status: 'SUBMITTED' }), null);
  assert.equal(getNextAction(null), null);
});

test('deadline states: ok, soon (4 hours or less), late, and breached', () => {
  assert.deepEqual(getDueInfo(job({ slaDueAt: minutesFromNow(600) }), NOW), { state: 'ok', minutes: 600 });
  assert.deepEqual(getDueInfo(job({ slaDueAt: minutesFromNow(240) }), NOW), { state: 'soon', minutes: 240 });
  assert.deepEqual(getDueInfo(job({ slaDueAt: minutesFromNow(241) }), NOW), { state: 'ok', minutes: 241 });
  assert.deepEqual(getDueInfo(job({ slaDueAt: minutesFromNow(-125) }), NOW), { state: 'late', minutes: 125 });
  const breached = getDueInfo(job({ slaStatus: 'BREACHED', slaDueAt: minutesFromNow(-30) }), NOW);
  assert.deepEqual(breached, { state: 'late', minutes: 30 });
  assert.equal(getDueInfo(job({ slaStatus: 'BREACHED', slaDueAt: null }), NOW).state, 'late');
  assert.equal(getDueInfo(job({ slaDueAt: null }), NOW).state, 'none');
  assert.equal(getDueInfo(job({ slaDueAt: 'not a date' }), NOW).state, 'none');
});

test('finished or waiting jobs never show a deadline', () => {
  for (const status of ['STUDENT_VERIFICATION', 'CLOSED', 'RESOLVED']) {
    assert.equal(getDueInfo(job({ status, slaDueAt: minutesFromNow(-500) }), NOW).state, 'none', status);
  }
});

test('durations use one friendly unit', () => {
  assert.deepEqual(splitDuration(0), { unit: 'minutes', n: 1 });
  assert.deepEqual(splitDuration(45), { unit: 'minutes', n: 45 });
  assert.deepEqual(splitDuration(60), { unit: 'hours', n: 1 });
  assert.deepEqual(splitDuration(150), { unit: 'hours', n: 3 });
  assert.deepEqual(splitDuration(47 * 60), { unit: 'hours', n: 47 });
  assert.deepEqual(splitDuration(48 * 60), { unit: 'days', n: 2 });
  assert.deepEqual(splitDuration(-5), { unit: 'minutes', n: 1 });
});

test('inside a section: late first, then priority, then nearest deadline', () => {
  const lateLow = job({ priority: 'LOW', slaDueAt: minutesFromNow(-10) });
  const urgentOk = job({ priority: 'HIGH', slaDueAt: minutesFromNow(900) });
  const normalSoon = job({ priority: 'MEDIUM', slaDueAt: minutesFromNow(100) });
  const normalLater = job({ priority: 'MEDIUM', slaDueAt: minutesFromNow(500) });
  const sorted = [normalLater, normalSoon, urgentOk, lateLow].sort((a, b) => compareJobs(a, b, NOW));
  assert.deepEqual(sorted, [lateLow, urgentOk, normalSoon, normalLater]);
});

test('jobs are grouped in the working sequence and empty sections disappear', () => {
  const jobs = [
    job({ status: 'CLOSED' }),
    job({ status: 'IN_PROGRESS' }),
    job({ status: 'ASSIGNED' }),
    job({ status: 'REOPENED' }),
    job({ status: 'STUDENT_VERIFICATION' }),
    job({ status: 'SUBMITTED' }), // not a technician job, must be dropped
  ];
  const sections = groupJobs(jobs, NOW);
  assert.deepEqual(sections.map((s) => s.stage), ['redo', 'new', 'working', 'waiting', 'done']);
  assert.equal(sections.flatMap((s) => s.jobs).length, 5);
  assert.deepEqual(groupJobs([], NOW), []);
  assert.deepEqual(groupJobs(undefined, NOW), []);
  assert.deepEqual(STAGE_ORDER, ['redo', 'new', 'ready', 'working', 'waiting', 'done']);
});

test('only jobs needing action are counted', () => {
  const jobs = [
    job({ status: 'ASSIGNED' }),
    job({ status: 'ACKNOWLEDGED' }),
    job({ status: 'IN_PROGRESS' }),
    job({ status: 'REOPENED' }),
    job({ status: 'STUDENT_VERIFICATION' }),
    job({ status: 'CLOSED' }),
  ];
  assert.equal(countActionable(jobs), 4);
  assert.equal(countActionable(undefined), 0);
});

test('progress steps run from got it to student confirms', () => {
  assert.equal(getProgressSteps({ status: 'ASSIGNED' }), 0);
  assert.equal(getProgressSteps({ status: 'ACKNOWLEDGED' }), 1);
  assert.equal(getProgressSteps({ status: 'IN_PROGRESS' }), 2);
  assert.equal(getProgressSteps({ status: 'REOPENED' }), 2);
  assert.equal(getProgressSteps({ status: 'STUDENT_VERIFICATION' }), 3);
  assert.equal(getProgressSteps({ status: 'CLOSED' }), 4);
});

test('location is read safely when parts are missing', () => {
  assert.deepEqual(getLocation(null), { room: '', block: '', floor: '', hostel: '' });
  assert.deepEqual(
    getLocation({
      roomId: { roomNumber: 101 },
      blockId: { name: 'Block 1' },
      floorId: { floorNumber: 1 },
      hostelId: { name: 'BBDU A and B Block' },
    }),
    { room: '101', block: 'Block 1', floor: 1, hostel: 'BBDU A and B Block' }
  );
});

test('deadline sentences read naturally in both languages', async () => {
  const { describeDue, formatDuration } = await import('../src/utils/jobFormat.js');
  const { translate } = await import('../src/i18n/dictionary.js');
  const en = (key, params) => translate('en', key, params);
  const hi = (key, params) => translate('hi', key, params);

  assert.equal(describeDue(en, { state: 'late', minutes: 125 }), 'Late by 2 hr');
  assert.equal(describeDue(en, { state: 'soon', minutes: 90 }), 'Hurry, due in 2 hr');
  assert.equal(describeDue(en, { state: 'ok', minutes: 3000 }), 'Due in 2 days');
  assert.equal(describeDue(en, { state: 'late', minutes: 20 }), 'Late by 20 min');
  assert.equal(describeDue(en, { state: 'none', minutes: 0 }), '');
  assert.equal(describeDue(en, undefined), '');
  assert.equal(describeDue(hi, { state: 'late', minutes: 125 }), '2 घंटे की देर हो गई');
  assert.equal(formatDuration(hi, 30), '30 मिनट');
});

test('short block names get the word Block, longer names are left alone', async () => {
  const { describeBlock } = await import('../src/utils/jobFormat.js');
  const { translate } = await import('../src/i18n/dictionary.js');
  const en = (key, params) => translate('en', key, params);
  const hi = (key, params) => translate('hi', key, params);
  assert.equal(describeBlock(en, '1'), 'Block 1');
  assert.equal(describeBlock(en, 'A'), 'Block A');
  assert.equal(describeBlock(hi, 'B'), 'ब्लॉक B');
  assert.equal(describeBlock(en, 'Tagore Wing'), 'Tagore Wing');
  assert.equal(describeBlock(en, ''), '');
  assert.equal(describeBlock(en, undefined), '');
});
