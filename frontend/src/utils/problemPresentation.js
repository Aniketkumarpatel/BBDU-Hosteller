/**
 * Pure rules for the Warden's "Problems" screens (DEC-029). No React, no browser APIs,
 * so everything here is unit tested with node:test. Reuses the deadline and ordering
 * rules the technician screens already use, so both roles always agree on "late".
 */
import { compareJobs, getDueInfo, getStage } from './jobPresentation.js';

// Order of the filter chips on the Problems screen, most urgent action first
export const WARDEN_FILTERS = ['assign', 'redo', 'late', 'with', 'waiting', 'done'];

// Filters that mean "the Warden has something to do"
export const ATTENTION_FILTERS = ['assign', 'redo', 'late'];

const TECHNICIAN_STAGES = ['ASSIGNED', 'ACKNOWLEDGED', 'IN_PROGRESS', 'WAITING_FOR_INFORMATION', 'ESCALATED'];

// How many finished problems to show before the list becomes noise
export const DONE_LIST_LIMIT = 10;

/**
 * Which filter a problem belongs to. Every problem is in exactly one, in this priority:
 * needs a technician, student says not fixed, late, with a technician, waiting, done.
 * @returns {'assign' | 'redo' | 'late' | 'with' | 'waiting' | 'done' | null} null for rejected problems
 */
export const getWardenBucket = (complaint, now = new Date()) => {
  const status = complaint?.status;
  if (status === 'SUBMITTED' || status === 'TRIAGED') return 'assign';
  if (status === 'REOPENED') return 'redo';
  if (TECHNICIAN_STAGES.includes(status)) {
    return getDueInfo({ ...complaint, status: 'IN_PROGRESS' }, now).state === 'late' ? 'late' : 'with';
  }
  if (status === 'STUDENT_VERIFICATION' || status === 'RESOLVED') return 'waiting';
  if (status === 'CLOSED') return 'done';
  return null;
};

/**
 * Status shown on the problem card, from the Warden's point of view.
 * @returns {'assign' | 'redo' | 'new' | 'ready' | 'working' | 'waiting' | 'done' | null}
 */
export const getWardenStage = (complaint) => {
  const status = complaint?.status;
  if (status === 'SUBMITTED' || status === 'TRIAGED') return 'assign';
  const stage = getStage(complaint);
  if (stage) return stage;
  if (TECHNICIAN_STAGES.includes(status)) return 'working';
  return null;
};

/** Problems that still have to be given to a technician: SUBMITTED needs triage first. */
export const needsTriage = (complaint) => complaint?.status === 'SUBMITTED';

/** The backend only allows changing the technician in these statuses. */
export const canChangeTechnician = (complaint) =>
  ['ASSIGNED', 'ACKNOWLEDGED', 'IN_PROGRESS'].includes(complaint?.status);

/** @returns {boolean} true while the problem still needs a first technician */
export const canGiveToTechnician = (complaint) =>
  complaint?.status === 'SUBMITTED' || complaint?.status === 'TRIAGED';

const doneTime = (c) => new Date(c?.closedAt || c?.verifiedAt || c?.updatedAt || 0).getTime();

/**
 * Splits problems into the filters, each ordered for action: late first, then more
 * urgent, then nearest deadline, then oldest. Finished problems are newest first.
 * @returns {Record<string, object[]>} one array per entry of WARDEN_FILTERS
 */
export const groupProblems = (complaints, now = new Date()) => {
  const groups = Object.fromEntries(WARDEN_FILTERS.map((key) => [key, []]));
  for (const complaint of complaints || []) {
    const bucket = getWardenBucket(complaint, now);
    if (bucket) groups[bucket].push(complaint);
  }
  for (const key of WARDEN_FILTERS) {
    if (key === 'done') groups.done.sort((a, b) => doneTime(b) - doneTime(a));
    else groups[key].sort((a, b) => compareJobs(a, b, now));
  }
  return groups;
};

export const countProblems = (groups) =>
  Object.fromEntries(WARDEN_FILTERS.map((key) => [key, groups[key]?.length || 0]));

/** How many problems need the Warden right now. */
export const countAttention = (counts) => ATTENTION_FILTERS.reduce((sum, key) => sum + (counts[key] || 0), 0);

/** The filter to open first: the first one that needs the Warden, else what is in progress. */
export const getDefaultFilter = (counts) => {
  for (const key of [...ATTENTION_FILTERS, 'with', 'waiting']) {
    if (counts[key] > 0) return key;
  }
  return 'assign';
};

// Which department codes (from the seed data) do each kind of problem.
// Only used to suggest a technician; the Warden can always pick anyone.
export const CATEGORY_TRADES = {
  PLUMBING: ['PLUMB'],
  WATER: ['WATER_MAINT', 'PLUMB'],
  ELECTRICAL: ['ELEC'],
  INTERNET: ['IT_NETWORK'],
  CLEANING: ['HOUSEKEEPING'],
  MESS: ['MESS_SERVICES'],
  FURNITURE: ['CIVIL_CARPENTRY'],
  ROOM: ['CIVIL_CARPENTRY'],
  SECURITY: [],
  OTHER: [],
};

/** Statuses in which a technician is actively holding a problem. */
const OPEN_FOR_TECHNICIAN = ['ASSIGNED', 'ACKNOWLEDGED', 'IN_PROGRESS', 'REOPENED'];

/** @returns {Record<string, number>} open problem count per technician id */
export const countOpenByTechnician = (complaints) => {
  const counts = {};
  for (const c of complaints || []) {
    if (!OPEN_FOR_TECHNICIAN.includes(c?.status)) continue;
    const id = String(c.assignedTo?._id || c.assignedTo || '');
    if (id) counts[id] = (counts[id] || 0) + 1;
  }
  return counts;
};

/**
 * Technicians to offer for one problem: the right trade first, then the least busy,
 * then by name. Only hostel staff are offered (not wardens). The current technician is left out.
 * @returns {Array<{ id: string, name: string, trade: string, suggested: boolean, openJobs: number }>}
 */
export const rankTechnicians = (staff, complaint, openCounts = {}) => {
  const trades = CATEGORY_TRADES[complaint?.category] || [];
  const currentId = String(complaint?.assignedTo?._id || complaint?.assignedTo || '');

  return (staff || [])
    .filter((s) => s?.role === 'HOSTEL_STAFF' && String(s._id || s.id) !== currentId)
    .map((s) => {
      const id = String(s._id || s.id);
      return {
        id,
        name: s.name || '',
        trade: s.departmentId?.name || '',
        departmentId: s.departmentId?._id || s.departmentId || '',
        suggested: trades.includes(s.departmentId?.code),
        openJobs: openCounts[id] || 0,
      };
    })
    .sort(
      (a, b) =>
        Number(b.suggested) - Number(a.suggested) ||
        a.openJobs - b.openJobs ||
        a.name.localeCompare(b.name)
    );
};
