/**
 * Pure rules that turn a complaint into what a technician needs to see (DEC-026).
 * No React and no browser APIs, so everything here is unit tested with node:test.
 */

// Order matters: this is the order sections appear on the "My jobs" screen, most
// urgent action first.
export const STAGE_ORDER = ['redo', 'new', 'ready', 'working', 'waiting', 'done'];

const STAGE_BY_STATUS = {
  REOPENED: 'redo',
  ASSIGNED: 'new',
  ACKNOWLEDGED: 'ready',
  IN_PROGRESS: 'working',
  STUDENT_VERIFICATION: 'waiting',
  RESOLVED: 'waiting',
  CLOSED: 'done',
};

// The one thing the technician can do at each stage. null means nothing to do.
const ACTION_BY_STAGE = {
  redo: 'resume',
  new: 'acknowledge',
  ready: 'start',
  working: 'finish',
  waiting: null,
  done: null,
};

/** Stages where the technician still has something to do. */
export const ACTIONABLE_STAGES = ['redo', 'new', 'ready', 'working'];

export const SOON_THRESHOLD_MINUTES = 4 * 60;

/** @returns {string | null} stage key, or null for statuses a technician never works on */
export const getStage = (complaint) => STAGE_BY_STATUS[complaint?.status] ?? null;

/** @returns {'acknowledge' | 'start' | 'finish' | 'resume' | null} */
export const getNextAction = (complaint) => {
  const stage = getStage(complaint);
  return stage ? ACTION_BY_STAGE[stage] : null;
};

/**
 * Deadline state for a job that still needs work.
 * @param {object} complaint
 * @param {Date} [now]
 * @returns {{ state: 'none' | 'ok' | 'soon' | 'late', minutes: number }}
 *   `minutes` is how long until the deadline, or how long past it when late.
 */
export const getDueInfo = (complaint, now = new Date()) => {
  const stage = getStage(complaint);
  if (!stage || !ACTIONABLE_STAGES.includes(stage)) return { state: 'none', minutes: 0 };

  const due = complaint?.slaDueAt ? new Date(complaint.slaDueAt) : null;
  const dueValid = due && !Number.isNaN(due.getTime());

  if (complaint?.slaStatus === 'BREACHED') {
    const late = dueValid ? Math.max(1, Math.round((now - due) / 60000)) : 1;
    return { state: 'late', minutes: late };
  }
  if (!dueValid) return { state: 'none', minutes: 0 };

  const minutes = Math.round((due - now) / 60000);
  if (minutes <= 0) return { state: 'late', minutes: Math.max(1, -minutes) };
  if (minutes <= SOON_THRESHOLD_MINUTES) return { state: 'soon', minutes };
  return { state: 'ok', minutes };
};

/**
 * Splits a duration into one friendly unit: minutes under an hour, hours under two
 * days, otherwise days.
 * @returns {{ unit: 'minutes' | 'hours' | 'days', n: number }}
 */
export const splitDuration = (minutes) => {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return { unit: 'minutes', n: Math.max(1, m) };
  if (m < 48 * 60) return { unit: 'hours', n: Math.round(m / 60) };
  return { unit: 'days', n: Math.round(m / (24 * 60)) };
};

const PRIORITY_RANK = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

/**
 * Orders jobs inside one section: late first, then the more urgent priority, then
 * the nearest deadline, then the oldest assignment.
 */
export const compareJobs = (a, b, now = new Date()) => {
  const lateA = getDueInfo(a, now).state === 'late' ? 0 : 1;
  const lateB = getDueInfo(b, now).state === 'late' ? 0 : 1;
  if (lateA !== lateB) return lateA - lateB;

  const prA = PRIORITY_RANK[a?.priority] ?? 9;
  const prB = PRIORITY_RANK[b?.priority] ?? 9;
  if (prA !== prB) return prA - prB;

  const dueA = a?.slaDueAt ? new Date(a.slaDueAt).getTime() : Infinity;
  const dueB = b?.slaDueAt ? new Date(b.slaDueAt).getTime() : Infinity;
  if (dueA !== dueB) return dueA - dueB;

  const createdA = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
  const createdB = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
  return createdA - createdB;
};

/**
 * Groups a technician's jobs into ordered sections. Jobs in statuses a technician
 * never works on are left out. Empty sections are omitted.
 * @returns {Array<{ stage: string, jobs: object[] }>}
 */
export const groupJobs = (complaints, now = new Date()) => {
  const buckets = new Map(STAGE_ORDER.map((stage) => [stage, []]));
  for (const complaint of complaints || []) {
    const stage = getStage(complaint);
    if (stage) buckets.get(stage).push(complaint);
  }
  return STAGE_ORDER.map((stage) => ({
    stage,
    jobs: buckets.get(stage).sort((a, b) => compareJobs(a, b, now)),
  })).filter((section) => section.jobs.length > 0);
};

/** Number of jobs the technician still has to act on. */
export const countActionable = (complaints) =>
  (complaints || []).filter((c) => ACTIONABLE_STAGES.includes(getStage(c))).length;

/**
 * Which of the four progress steps are done for the job screen:
 * got it, started, finished, student confirms.
 * @returns {number} how many steps are complete (0 to 4)
 */
export const getProgressSteps = (complaint) => {
  switch (getStage(complaint)) {
    case 'ready':
      return 1;
    case 'working':
    case 'redo':
      return 2;
    case 'waiting':
      return 3;
    case 'done':
      return 4;
    default:
      return 0;
  }
};

/** Room and block as plain values for display; empty strings when unknown. */
export const getLocation = (complaint) => ({
  room: complaint?.roomId?.roomNumber ? String(complaint.roomId.roomNumber) : '',
  block: complaint?.blockId?.name || '',
  floor: complaint?.floorId?.name || (complaint?.floorId?.floorNumber ?? ''),
  hostel: complaint?.hostelId?.name || '',
});
