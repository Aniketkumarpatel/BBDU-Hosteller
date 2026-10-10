/**
 * Pure rules for the student screens (DEC-031): where a problem stands in the student's
 * words, how far along it is, when it was promised, a real timeline, and how a few taps
 * become a valid report. No React and no browser APIs, so it is unit tested with node:test.
 */

// Student-facing stages in order. 'redo' is the student's own "not fixed" answer coming back.
export const STUDENT_STAGES = ['sent', 'given', 'working', 'confirm', 'redo', 'done'];

const STAGE_BY_STATUS = {
  SUBMITTED: 'sent',
  TRIAGED: 'sent',
  ASSIGNED: 'given',
  ACKNOWLEDGED: 'given',
  IN_PROGRESS: 'working',
  WAITING_FOR_INFORMATION: 'working',
  ESCALATED: 'working',
  STUDENT_VERIFICATION: 'confirm',
  RESOLVED: 'confirm',
  REOPENED: 'redo',
  CLOSED: 'done',
};

/** @returns {'sent' | 'given' | 'working' | 'confirm' | 'redo' | 'done' | null} null for rejected problems */
export const getStudentStage = (complaint) => STAGE_BY_STATUS[complaint?.status] ?? null;

/** A problem is active until it is fixed and confirmed, or rejected. */
export const isActive = (complaint) => {
  const stage = getStudentStage(complaint);
  return stage !== null && stage !== 'done';
};

/** How many of the four progress segments (sent, given, fixing, confirm) are filled. */
export const getProgress = (complaint) => {
  switch (getStudentStage(complaint)) {
    case 'sent':
      return 1;
    case 'given':
      return 2;
    case 'working':
    case 'redo':
    case 'confirm':
      return 3;
    case 'done':
      return 4;
    default:
      return 0;
  }
};

/** True when the student has something to do: confirm the fix or not. */
export const needsConfirmation = (complaint) => getStudentStage(complaint) === 'confirm';

/**
 * The promised time for an active problem. 'late' is shown gently to the student.
 * @returns {{ state: 'none' | 'by' | 'late', at: Date | null, minutes: number }}
 */
export const getEta = (complaint, now = new Date()) => {
  const stage = getStudentStage(complaint);
  if (!stage || stage === 'done' || stage === 'confirm') return { state: 'none', at: null, minutes: 0 };
  const due = complaint?.slaDueAt ? new Date(complaint.slaDueAt) : null;
  if (!due || Number.isNaN(due.getTime())) return { state: 'none', at: null, minutes: 0 };
  const minutes = Math.round((due - now) / 60000);
  if (complaint.slaStatus === 'BREACHED' || minutes <= 0) return { state: 'late', at: due, minutes: Math.max(1, Math.abs(minutes)) };
  return { state: 'by', at: due, minutes };
};

const RANK = { sent: 0, given: 1, working: 2, redo: 2, confirm: 3, done: 4 };

/**
 * Timeline entries: reported, given, started, finished, confirmed. `done` marks what has
 * happened, `current` is the next thing to happen (or the one in progress).
 * @returns {Array<{ key: string, at: string | null, name: string, done: boolean, current: boolean }>}
 */
export const buildTimeline = (complaint) => {
  const stage = getStudentStage(complaint);
  const rank = stage ? RANK[stage] : 0;
  const technician = complaint?.assignedTo?.name || '';
  const steps = [
    { key: 'reported', at: complaint?.createdAt || complaint?.submittedAt || null, name: '', done: true },
    { key: 'given', at: complaint?.assignedAt || null, name: technician, done: rank >= 1 },
    { key: 'started', at: complaint?.startedAt || null, name: technician, done: rank >= 2 && stage !== 'redo' },
    { key: 'finished', at: complaint?.resolvedAt || null, name: technician, done: rank >= 3 },
    { key: 'confirmed', at: complaint?.closedAt || complaint?.verifiedAt || null, name: '', done: rank >= 4 },
  ];
  const currentIndex = steps.findIndex((s) => !s.done);
  return steps.map((s, i) => ({ ...s, current: i === currentIndex }));
};

// --- Reporting a problem -----------------------------------------------------------------

// Plain issue choices per category. Every value must be allowed by the backend for that
// category (tests/studentPresentation.test.js checks this against the backend list).
export const REPORT_ISSUES = {
  PLUMBING: ['WATER_LEAKAGE', 'TAP_BROKEN', 'DRAIN_BLOCKAGE', 'FLUSH_NOT_WORKING', 'OTHER_PLUMBING'],
  WATER: ['WATER_SUPPLY', 'NO_DRINKING_WATER', 'HOT_WATER_ISSUE', 'OTHER_WATER'],
  ELECTRICAL: ['LIGHT_NOT_WORKING', 'FAN_NOT_WORKING', 'SWITCH_SOCKET_ISSUE', 'ELECTRICITY_FAILURE', 'OTHER_ELECTRICAL'],
  INTERNET: ['INTERNET_NOT_WORKING', 'SLOW_SPEED', 'WIFI_ROUTER_DOWN', 'LAN_PORT_ISSUE', 'OTHER_INTERNET'],
  CLEANING: ['CLEANING_REQUIRED', 'DIRTY_WASHROOM', 'CORRIDOR_DIRTY', 'GARBAGE_COLLECTION', 'OTHER_CLEANING'],
  FURNITURE: ['BED_BROKEN', 'STUDY_TABLE_CHAIR', 'CUPBOARD_LOCK', 'FURNITURE_DAMAGE', 'OTHER_FURNITURE'],
  ROOM: ['DOOR_LOCK_ISSUE', 'WINDOW_GLASS_BROKEN', 'WALL_SEEPAGE', 'ROOM_ISSUE', 'OTHER_ROOM'],
  MESS: ['POOR_FOOD_QUALITY', 'MESS_HYGIENE', 'FOOD_QUANTITY_ISSUE', 'SERVING_DELAY', 'OTHER_MESS'],
  SECURITY: ['SECURITY_CONCERN', 'UNAUTHORIZED_ENTRY', 'NOISE_DISTURBANCE', 'THEFT_REPORT', 'OTHER_SECURITY'],
  OTHER: ['OTHER'],
};

// Order of the category tiles on the home screen and in the report flow
export const REPORT_CATEGORIES = ['PLUMBING', 'ELECTRICAL', 'WATER', 'INTERNET', 'CLEANING', 'FURNITURE', 'ROOM', 'MESS', 'SECURITY', 'OTHER'];

export const URGENCY_CHOICES = ['MEDIUM', 'HIGH', 'CRITICAL'];

const isOtherType = (issueType) => issueType === 'OTHER' || issueType.startsWith('OTHER_');

/**
 * Builds the API payload from the student's taps. The title is the English label of the
 * choice so the Warden and technician see the same short words; the student's own words go
 * in the description. Never needs typing: with no text the description is generated.
 *
 * @param {{ category: string, issueType: string, text?: string, priority?: string }} input
 * @param {{ issueLabel: string, categoryLabel: string }} labels English labels
 */
export const buildReportPayload = ({ category, issueType, text = '', priority = 'MEDIUM' }, { issueLabel, categoryLabel }) => {
  const own = text.trim().slice(0, 1500);
  const title = isOtherType(issueType) ? `${categoryLabel} problem` : issueLabel;
  const description = own ? `${title}. ${own}` : `${title} in my room.`;
  return { title, description, category, issueType, priority };
};
