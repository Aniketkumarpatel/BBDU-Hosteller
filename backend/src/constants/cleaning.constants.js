/**
 * Controlled constants for Cleaning & Housekeeping Management Module
 */

export const AREA_TYPES = Object.freeze({
  ROOM: 'ROOM',
  WASHROOM: 'WASHROOM',
  CORRIDOR: 'CORRIDOR',
  STAIRCASE: 'STAIRCASE',
  COMMON_ROOM: 'COMMON_ROOM',
  STUDY_AREA: 'STUDY_AREA',
  LOBBY: 'LOBBY',
  OUTDOOR: 'OUTDOOR',
  MESS_ADJACENT: 'MESS_ADJACENT',
  OTHER: 'OTHER',
});

export const AREA_TYPE_VALUES = Object.freeze(Object.values(AREA_TYPES));

export const CLEANING_TYPES = Object.freeze({
  ROUTINE: 'ROUTINE',
  DEEP_CLEANING: 'DEEP_CLEANING',
  SANITIZATION: 'SANITIZATION',
  WASHROOM_CLEANING: 'WASHROOM_CLEANING',
  WASTE_COLLECTION: 'WASTE_COLLECTION',
  COMMON_AREA_CLEANING: 'COMMON_AREA_CLEANING',
  INSPECTION_CLEANING: 'INSPECTION_CLEANING',
  OTHER: 'OTHER',
});

export const CLEANING_TYPE_VALUES = Object.freeze(Object.values(CLEANING_TYPES));

export const CLEANING_FREQUENCIES = Object.freeze({
  DAILY: 'DAILY',
  WEEKLY: 'WEEKLY',
  MONTHLY: 'MONTHLY',
  CUSTOM: 'CUSTOM',
});

export const CLEANING_FREQUENCY_VALUES = Object.freeze(Object.values(CLEANING_FREQUENCIES));

export const CLEANING_TASK_STATUSES = Object.freeze({
  CREATED: 'CREATED',
  ASSIGNED: 'ASSIGNED',
  ACCEPTED: 'ACCEPTED',
  IN_PROGRESS: 'IN_PROGRESS',
  ON_HOLD: 'ON_HOLD',
  COMPLETED: 'COMPLETED',
  VERIFIED: 'VERIFIED',
  MISSED: 'MISSED',
  CANCELLED: 'CANCELLED',
});

export const CLEANING_TASK_STATUS_VALUES = Object.freeze(Object.values(CLEANING_TASK_STATUSES));

export const CLEANING_PRIORITIES = Object.freeze({
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
});

export const CLEANING_PRIORITY_VALUES = Object.freeze(Object.values(CLEANING_PRIORITIES));

export const DEFAULT_CHECKLISTS = Object.freeze({
  ROOM: [
    'Brooming and wet-mopping floor',
    'Dusting furniture, bedframes and study tables',
    'Emptying and lining trash bins',
    'Cobweb removal and ceiling fan cleaning',
    'Window glass and sill cleaning',
  ],
  WASHROOM: [
    'Floor scrubbed and disinfected with chemical agent',
    'Toilet bowls and urinals descaled and sanitized',
    'Washbasins and mirrors wiped spotless',
    'Sanitary bins emptied and replaced with clean liner',
    'Exhaust vents checked and cleaned',
  ],
  CORRIDOR: [
    'Floor swept and wet-mopped thoroughly',
    'All corridor trash bins emptied and wiped',
    'Handrails and switchboards sanitized',
    'Corridor lighting fixtures and corners dusted',
  ],
  STAIRCASE: [
    'Steps swept and damp-mopped',
    'Handrails and railings disinfected',
    'Landing areas cleared of debris',
  ],
  COMMON_ROOM: [
    'Floor swept and mopped',
    'Tables, chairs, and recreation facilities wiped',
    'Waste bins emptied and sanitized',
    'Door handles and high-touch areas disinfected',
  ],
  DEFAULT: [
    'Area thoroughly swept and mopped',
    'Waste collected, segregated and disposed',
    'High-touch surfaces sanitized',
    'Visual inspection completed and area secured',
  ],
});
