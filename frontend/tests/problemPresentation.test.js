import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getWardenBucket,
  getWardenStage,
  canChangeTechnician,
  canGiveToTechnician,
  needsTriage,
  groupProblems,
  countProblems,
  countAttention,
  getDefaultFilter,
  countOpenByTechnician,
  rankTechnicians,
  CATEGORY_TRADES,
  WARDEN_FILTERS,
} from '../src/utils/problemPresentation.js';
import { COMPLAINT_STATUS_VALUES, COMPLAINT_CATEGORY_VALUES } from '../../backend/src/constants/complaint.constants.js';

const NOW = new Date('2026-10-10T10:00:00Z');
const minutesFromNow = (m) => new Date(NOW.getTime() + m * 60000).toISOString();
const problem = (overrides = {}) => ({
  _id: Math.random().toString(36).slice(2),
  status: 'SUBMITTED',
  priority: 'MEDIUM',
  category: 'PLUMBING',
  slaStatus: 'ACTIVE',
  slaDueAt: null,
  createdAt: minutesFromNow(-60),
  ...overrides,
});

test('every backend status lands in exactly one filter or is deliberately ignored', () => {
  const ignored = COMPLAINT_STATUS_VALUES.filter((status) => getWardenBucket({ status }, NOW) === null);
  assert.deepEqual(ignored, ['REJECTED']);
  for (const status of COMPLAINT_STATUS_VALUES) {
    const bucket = getWardenBucket({ status }, NOW);
    assert.ok(bucket === null || WARDEN_FILTERS.includes(bucket), `${status} -> ${bucket}`);
  }
});

test('buckets follow the Warden priority: assign, not fixed, late, with technician, waiting, done', () => {
  assert.equal(getWardenBucket(problem({ status: 'SUBMITTED' }), NOW), 'assign');
  assert.equal(getWardenBucket(problem({ status: 'TRIAGED' }), NOW), 'assign');
  assert.equal(getWardenBucket(problem({ status: 'REOPENED', slaStatus: 'BREACHED' }), NOW), 'redo', 'not fixed beats late');
  assert.equal(getWardenBucket(problem({ status: 'IN_PROGRESS', slaDueAt: minutesFromNow(300) }), NOW), 'with');
  assert.equal(getWardenBucket(problem({ status: 'IN_PROGRESS', slaDueAt: minutesFromNow(-5) }), NOW), 'late');
  assert.equal(getWardenBucket(problem({ status: 'ASSIGNED', slaStatus: 'BREACHED', slaDueAt: minutesFromNow(-90) }), NOW), 'late');
  assert.equal(getWardenBucket(problem({ status: 'ACKNOWLEDGED' }), NOW), 'with', 'no deadline means not late');
  assert.equal(getWardenBucket(problem({ status: 'STUDENT_VERIFICATION' }), NOW), 'waiting');
  assert.equal(getWardenBucket(problem({ status: 'CLOSED' }), NOW), 'done');
  assert.equal(getWardenBucket(null, NOW), null);
});

test('the card status uses the Warden wording stages', () => {
  assert.equal(getWardenStage({ status: 'SUBMITTED' }), 'assign');
  assert.equal(getWardenStage({ status: 'TRIAGED' }), 'assign');
  assert.equal(getWardenStage({ status: 'ASSIGNED' }), 'new');
  assert.equal(getWardenStage({ status: 'ACKNOWLEDGED' }), 'ready');
  assert.equal(getWardenStage({ status: 'IN_PROGRESS' }), 'working');
  assert.equal(getWardenStage({ status: 'REOPENED' }), 'redo');
  assert.equal(getWardenStage({ status: 'STUDENT_VERIFICATION' }), 'waiting');
  assert.equal(getWardenStage({ status: 'CLOSED' }), 'done');
  assert.equal(getWardenStage({ status: 'WAITING_FOR_INFORMATION' }), 'working');
  assert.equal(getWardenStage({ status: 'REJECTED' }), null);
});

test('the Warden is only offered actions the backend will accept', () => {
  for (const status of ['SUBMITTED', 'TRIAGED']) {
    assert.equal(canGiveToTechnician({ status }), true, status);
    assert.equal(canChangeTechnician({ status }), false, status);
  }
  for (const status of ['ASSIGNED', 'ACKNOWLEDGED', 'IN_PROGRESS']) {
    assert.equal(canChangeTechnician({ status }), true, status);
    assert.equal(canGiveToTechnician({ status }), false, status);
  }
  for (const status of ['REOPENED', 'STUDENT_VERIFICATION', 'CLOSED', 'REJECTED']) {
    assert.equal(canChangeTechnician({ status }), false, status);
    assert.equal(canGiveToTechnician({ status }), false, status);
  }
  assert.equal(needsTriage({ status: 'SUBMITTED' }), true, 'submitted must be triaged before it can be assigned');
  assert.equal(needsTriage({ status: 'TRIAGED' }), false);
});

test('problems are grouped and ordered for action', () => {
  const lateOne = problem({ status: 'IN_PROGRESS', slaDueAt: minutesFromNow(-30), priority: 'LOW' });
  const okOne = problem({ status: 'ASSIGNED', slaDueAt: minutesFromNow(500) });
  const urgentNew = problem({ status: 'SUBMITTED', priority: 'CRITICAL', createdAt: minutesFromNow(-10) });
  const olderNormal = problem({ status: 'SUBMITTED', priority: 'MEDIUM', createdAt: minutesFromNow(-300) });
  const olderDone = problem({ status: 'CLOSED', closedAt: minutesFromNow(-2000) });
  const newerDone = problem({ status: 'CLOSED', closedAt: minutesFromNow(-100) });
  const rejected = problem({ status: 'REJECTED' });

  const groups = groupProblems([olderNormal, urgentNew, okOne, lateOne, olderDone, newerDone, rejected], NOW);
  assert.deepEqual(groups.assign, [urgentNew, olderNormal], 'more urgent first');
  assert.deepEqual(groups.late, [lateOne]);
  assert.deepEqual(groups.with, [okOne]);
  assert.deepEqual(groups.done, [newerDone, olderDone], 'finished problems newest first');
  assert.equal(Object.values(groups).flat().includes(rejected), false);

  const counts = countProblems(groups);
  assert.deepEqual(counts, { assign: 2, redo: 0, late: 1, with: 1, waiting: 0, done: 2 });
  assert.equal(countAttention(counts), 3);
  assert.deepEqual(groupProblems(undefined, NOW).assign, []);
});

test('the screen opens on the first filter that needs the Warden', () => {
  assert.equal(getDefaultFilter({ assign: 2, redo: 1, late: 3, with: 5, waiting: 1, done: 4 }), 'assign');
  assert.equal(getDefaultFilter({ assign: 0, redo: 1, late: 3, with: 5, waiting: 1, done: 4 }), 'redo');
  assert.equal(getDefaultFilter({ assign: 0, redo: 0, late: 3, with: 5, waiting: 1, done: 4 }), 'late');
  assert.equal(getDefaultFilter({ assign: 0, redo: 0, late: 0, with: 5, waiting: 1, done: 4 }), 'with');
  assert.equal(getDefaultFilter({ assign: 0, redo: 0, late: 0, with: 0, waiting: 1, done: 4 }), 'waiting');
  assert.equal(getDefaultFilter({ assign: 0, redo: 0, late: 0, with: 0, waiting: 0, done: 4 }), 'assign');
});

test('open jobs are counted per technician, from the statuses that mean work is waiting', () => {
  const counts = countOpenByTechnician([
    problem({ status: 'ASSIGNED', assignedTo: { _id: 'a' } }),
    problem({ status: 'IN_PROGRESS', assignedTo: 'a' }),
    problem({ status: 'REOPENED', assignedTo: 'b' }),
    problem({ status: 'STUDENT_VERIFICATION', assignedTo: 'a' }),
    problem({ status: 'CLOSED', assignedTo: 'a' }),
    problem({ status: 'SUBMITTED', assignedTo: null }),
  ]);
  assert.deepEqual(counts, { a: 2, b: 1 });
});

test('technicians are offered by trade first, then least busy, then name', () => {
  const staff = [
    { _id: 'w', role: 'WARDEN', name: 'Warden', departmentId: null },
    { _id: 'e1', role: 'HOSTEL_STAFF', name: 'Suresh', departmentId: { _id: 'd2', name: 'Electrical', code: 'ELEC' } },
    { _id: 'p1', role: 'HOSTEL_STAFF', name: 'Ramesh', departmentId: { _id: 'd1', name: 'Plumbing', code: 'PLUMB' } },
    { _id: 'p2', role: 'HOSTEL_STAFF', name: 'Anil', departmentId: { _id: 'd1', name: 'Plumbing', code: 'PLUMB' } },
    { _id: 'n1', role: 'HOSTEL_STAFF', name: 'Bhola', departmentId: null },
  ];
  const ranked = rankTechnicians(staff, { category: 'PLUMBING' }, { p1: 3, p2: 1 });
  assert.deepEqual(ranked.map((r) => r.name), ['Anil', 'Ramesh', 'Bhola', 'Suresh']);
  assert.deepEqual(ranked.map((r) => r.suggested), [true, true, false, false]);
  assert.equal(ranked.some((r) => r.name === 'Warden'), false, 'wardens are not offered');
  assert.deepEqual(ranked[0], { id: 'p2', name: 'Anil', trade: 'Plumbing', departmentId: 'd1', suggested: true, openJobs: 1 });
});

test('the current technician is not offered again, and unknown categories suggest nobody', () => {
  const staff = [
    { _id: 'p1', role: 'HOSTEL_STAFF', name: 'Ramesh', departmentId: { _id: 'd1', name: 'Plumbing', code: 'PLUMB' } },
    { _id: 'p2', role: 'HOSTEL_STAFF', name: 'Anil', departmentId: { _id: 'd1', name: 'Plumbing', code: 'PLUMB' } },
  ];
  const withCurrent = rankTechnicians(staff, { category: 'PLUMBING', assignedTo: { _id: 'p1' } }, {});
  assert.deepEqual(withCurrent.map((r) => r.id), ['p2']);
  const none = rankTechnicians(staff, { category: 'SECURITY' }, {});
  assert.equal(none.some((r) => r.suggested), false);
  assert.deepEqual(rankTechnicians(undefined, { category: 'PLUMBING' }), []);
});

test('every backend category has a trade entry so suggestions never silently disappear', () => {
  for (const category of COMPLAINT_CATEGORY_VALUES) {
    assert.ok(category in CATEGORY_TRADES, `CATEGORY_TRADES is missing ${category}`);
  }
});
