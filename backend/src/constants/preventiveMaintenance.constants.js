/**
 * Constants for Preventive Maintenance & Smart Scheduling (Step 9)
 */

export const MAINTENANCE_TYPES = Object.freeze({
  ROUTINE: 'ROUTINE',
  PREVENTIVE: 'PREVENTIVE',
  INSPECTION: 'INSPECTION',
  SERVICING: 'SERVICING',
});

export const MAINTENANCE_TYPE_VALUES = Object.freeze(Object.values(MAINTENANCE_TYPES));

export const FREQUENCY_UNITS = Object.freeze({
  DAYS: 'DAYS',
  WEEKS: 'WEEKS',
  MONTHS: 'MONTHS',
});

export const FREQUENCY_UNIT_VALUES = Object.freeze(Object.values(FREQUENCY_UNITS));

export const MAINTENANCE_PLAN_STATUSES = Object.freeze({
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
});

export const MAINTENANCE_PLAN_STATUS_VALUES = Object.freeze(
  Object.values(MAINTENANCE_PLAN_STATUSES)
);

export const CYCLE_STATUSES = Object.freeze({
  SCHEDULED: 'SCHEDULED',
  WORK_ORDER_CREATED: 'WORK_ORDER_CREATED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  OVERDUE: 'OVERDUE',
  SKIPPED: 'SKIPPED',
});

export const CYCLE_STATUS_VALUES = Object.freeze(Object.values(CYCLE_STATUSES));

export const ASSET_HEALTH_STATUSES = Object.freeze({
  HEALTHY: 'HEALTHY',
  MAINTENANCE_DUE: 'MAINTENANCE_DUE',
  OVERDUE: 'OVERDUE',
  FREQUENTLY_FAILING: 'FREQUENTLY_FAILING',
  CRITICAL: 'CRITICAL',
  RETIRED: 'RETIRED',
});

export const ASSET_HEALTH_STATUS_VALUES = Object.freeze(
  Object.values(ASSET_HEALTH_STATUSES)
);

// Default threshold settings
export const PREVENTIVE_THRESHOLDS = Object.freeze({
  UPCOMING_DAYS_THRESHOLD: 7,
  FREQUENT_FAILURE_WORK_ORDER_COUNT: 3,
  FREQUENT_FAILURE_WINDOW_DAYS: 90,
});
