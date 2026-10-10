import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getStudentStage,
  isActive,
  getProgress,
  needsConfirmation,
  getEta,
  buildTimeline,
  buildReportPayload,
  REPORT_ISSUES,
  REPORT_CATEGORIES,
  URGENCY_CHOICES,
} from '../src/utils/studentPresentation.js';
import { COMPLAINT_STATUS_VALUES, CATEGORY_ISSUE_TYPES, COMPLAINT_CATEGORY_VALUES, COMPLAINT_PRIORITY_VALUES } from '../../backend/src/constants/complaint.constants.js';
import { validateComplaintInput } from '../../backend/src/validators/complaint.validator.js';
import { DICTIONARY } from '../src/i18n/dictionary.js';

const NOW = new Date('2026-10-10T10:00:00Z');
const at = (m) => new Date(NOW.getTime() + m * 60000).toISOString();

test('every backend status maps to a student stage or is deliberately hidden', () => {
  const hidden = COMPLAINT_STATUS_VALUES.filter((status) => getStudentStage({ status }) === null);
  assert.deepEqual(hidden, ['REJECTED']);
});

test('stages, activity and progress follow the lifecycle', () => {
  const cases = [
    ['SUBMITTED', 'sent', 1, true],
    ['TRIAGED', 'sent', 1, true],
    ['ASSIGNED', 'given', 2, true],
    ['ACKNOWLEDGED', 'given', 2, true],
    ['IN_PROGRESS', 'working', 3, true],
    ['STUDENT_VERIFICATION', 'confirm', 3, true],
    ['REOPENED', 'redo', 3, true],
    ['CLOSED', 'done', 4, false],
  ];
  for (const [status, stage, progress, active] of cases) {
    assert.equal(getStudentStage({ status }), stage, status);
    assert.equal(getProgress({ status }), progress, status);
    assert.equal(isActive({ status }), active, status);
  }
  assert.equal(isActive({ status: 'REJECTED' }), false);
  assert.equal(needsConfirmation({ status: 'STUDENT_VERIFICATION' }), true);
  assert.equal(needsConfirmation({ status: 'IN_PROGRESS' }), false);
});

test('the promised time is shown for active work, gently when it runs over', () => {
  const by = getEta({ status: 'IN_PROGRESS', slaDueAt: at(120), slaStatus: 'ACTIVE' }, NOW);
  assert.equal(by.state, 'by');
  assert.equal(by.minutes, 120);
  assert.equal(by.at.toISOString(), at(120));
  assert.equal(getEta({ status: 'IN_PROGRESS', slaDueAt: at(-45), slaStatus: 'ACTIVE' }, NOW).state, 'late');
  assert.equal(getEta({ status: 'ASSIGNED', slaDueAt: at(300), slaStatus: 'BREACHED' }, NOW).state, 'late');
  assert.equal(getEta({ status: 'STUDENT_VERIFICATION', slaDueAt: at(-45) }, NOW).state, 'none', 'nothing is promised once it is fixed');
  assert.equal(getEta({ status: 'CLOSED', slaDueAt: at(60) }, NOW).state, 'none');
  assert.equal(getEta({ status: 'SUBMITTED', slaDueAt: null }, NOW).state, 'none');
  assert.equal(getEta({ status: 'ASSIGNED', slaDueAt: 'bad' }, NOW).state, 'none');
});

test('the timeline marks what happened and highlights the next step', () => {
  const c = {
    status: 'IN_PROGRESS',
    createdAt: at(-300),
    assignedAt: at(-240),
    startedAt: at(-200),
    assignedTo: { name: 'Ramesh' },
  };
  const tl = buildTimeline(c);
  assert.deepEqual(tl.map((s) => s.key), ['reported', 'given', 'started', 'finished', 'confirmed']);
  assert.deepEqual(tl.map((s) => s.done), [true, true, true, false, false]);
  assert.equal(tl.find((s) => s.current).key, 'finished');
  assert.equal(tl[1].name, 'Ramesh');
  assert.equal(tl[1].at, c.assignedAt);

  assert.deepEqual(buildTimeline({ status: 'SUBMITTED', createdAt: at(-5) }).map((s) => s.done), [true, false, false, false, false]);
  assert.deepEqual(buildTimeline({ status: 'CLOSED' }).map((s) => s.done), [true, true, true, true, true]);
  assert.equal(buildTimeline({ status: 'CLOSED' }).some((s) => s.current), false);
  const redo = buildTimeline({ status: 'REOPENED', assignedAt: at(-100) });
  assert.equal(redo.find((s) => s.key === 'started').done, false, 'a reopened problem is not yet started again');
});

test('every issue choice is allowed by the backend for its category', () => {
  for (const [category, types] of Object.entries(REPORT_ISSUES)) {
    assert.ok(COMPLAINT_CATEGORY_VALUES.includes(category), `${category} is not a backend category`);
    for (const type of types) {
      assert.ok(CATEGORY_ISSUE_TYPES[category].includes(type), `${type} is not valid for ${category}`);
    }
  }
  assert.deepEqual([...REPORT_CATEGORIES].sort(), [...COMPLAINT_CATEGORY_VALUES].sort(), 'every backend category is offered');
  for (const c of REPORT_CATEGORIES) assert.ok(REPORT_ISSUES[c].length > 0, c);
  for (const p of URGENCY_CHOICES) assert.ok(COMPLAINT_PRIORITY_VALUES.includes(p), p);
});

test('every issue choice and every category has a label in both languages', () => {
  for (const lang of ['en', 'hi']) {
    for (const types of Object.values(REPORT_ISSUES)) {
      for (const type of types) {
        const key = type === 'OTHER' || type.startsWith('OTHER_') ? 'issue.other' : `issue.${type}`;
        assert.ok(DICTIONARY[lang][key], `${lang} missing ${key}`);
      }
    }
  }
});

test('a few taps become a report the backend accepts, with or without typing', () => {
  const labels = { issueLabel: 'Water leaking', categoryLabel: 'Water and pipes' };
  const tapsOnly = buildReportPayload({ category: 'PLUMBING', issueType: 'WATER_LEAKAGE' }, labels);
  assert.deepEqual(tapsOnly, {
    title: 'Water leaking',
    description: 'Water leaking in my room.',
    category: 'PLUMBING',
    issueType: 'WATER_LEAKAGE',
    priority: 'MEDIUM',
  });
  assert.equal(validateComplaintInput(tapsOnly).isValid, true);

  const typed = buildReportPayload({ category: 'PLUMBING', issueType: 'WATER_LEAKAGE', text: '  Floor is wet all night  ', priority: 'HIGH' }, labels);
  assert.equal(typed.description, 'Water leaking. Floor is wet all night');
  assert.equal(typed.priority, 'HIGH');
  assert.equal(validateComplaintInput(typed).isValid, true);

  const other = buildReportPayload({ category: 'ELECTRICAL', issueType: 'OTHER_ELECTRICAL' }, { issueLabel: 'Something else', categoryLabel: 'Electricity' });
  assert.equal(other.title, 'Electricity problem');
  assert.equal(validateComplaintInput(other).isValid, true);

  const long = buildReportPayload({ category: 'OTHER', issueType: 'OTHER', text: 'x'.repeat(5000) }, { issueLabel: 'Something else', categoryLabel: 'Other' });
  assert.equal(validateComplaintInput(long).isValid, true, 'very long text is cut to a valid length');
});

test('every report built from every choice passes the backend validator', () => {
  for (const [category, types] of Object.entries(REPORT_ISSUES)) {
    for (const issueType of types) {
      for (const priority of URGENCY_CHOICES) {
        const payload = buildReportPayload(
          { category, issueType, priority },
          { issueLabel: DICTIONARY.en[`issue.${issueType}`] || DICTIONARY.en['issue.other'], categoryLabel: DICTIONARY.en[`category.${category}`] }
        );
        const result = validateComplaintInput(payload);
        assert.equal(result.isValid, true, `${category}/${issueType}/${priority}: ${result.errors.join('; ')}`);
      }
    }
  }
});

test('"fix by" shows only the time today and the day and time otherwise', async () => {
  const { formatWhen, formatLeft } = await import('../src/utils/studentFormat.js');
  const { translate } = await import('../src/i18n/dictionary.js');
  const now = new Date(2026, 9, 10, 12, 0, 0);
  const today = new Date(2026, 9, 10, 17, 0, 0);
  const tomorrow = new Date(2026, 9, 11, 17, 0, 0);
  const todayText = formatWhen(today, 'en', now);
  const tomorrowText = formatWhen(tomorrow, 'en', now);
  assert.equal(todayText.includes(','), false, 'today shows the time only');
  assert.equal(tomorrowText.includes(','), true, 'another day shows the date and the time');
  assert.ok(tomorrowText.length > todayText.length);
  assert.match(todayText, /5/);
  assert.equal(formatWhen('', 'en', now), '');
  assert.equal(formatWhen('not a date', 'hi', now), '');
  assert.notEqual(formatWhen(today, 'hi', now), '');
  const en = (key, params) => translate('en', key, params);
  assert.equal(formatLeft(en, 120), '2 hr');
  assert.equal(formatLeft(en, 20), '20 min');
});
