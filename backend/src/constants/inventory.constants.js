/**
 * Constants for Hostel Inventory & Asset Lifecycle Management System (Step 14)
 */

export const OPERATIONAL_FLAGS = Object.freeze({
  NORMAL: 'NORMAL',
  WATCH: 'WATCH',
  FREQUENT_FAILURE: 'FREQUENT_FAILURE',
  CRITICAL: 'CRITICAL',
});

export const OPERATIONAL_FLAG_VALUES = Object.freeze(Object.values(OPERATIONAL_FLAGS));

export const WARRANTY_STATUSES = Object.freeze({
  ACTIVE: 'ACTIVE',
  EXPIRING_SOON: 'EXPIRING_SOON',
  EXPIRED: 'EXPIRED',
  NO_WARRANTY: 'NO_WARRANTY',
});

export const WARRANTY_STATUS_VALUES = Object.freeze(Object.values(WARRANTY_STATUSES));

export const COMMON_AREAS = Object.freeze({
  COMMON_ROOM: 'Common Room',
  CORRIDOR: 'Corridor',
  MESS: 'Mess Dining Hall',
  STUDY_AREA: 'Study Area',
  SECURITY_OFFICE: 'Security Office',
  WARDEN_OFFICE: 'Warden Office',
  RECREATION_ROOM: 'Recreation Room',
  GYM: 'Hostel Gym',
  OTHER: 'Other Common Area',
});

export const COMMON_AREA_VALUES = Object.freeze(Object.values(COMMON_AREAS));

export const INVENTORY_THRESHOLDS = Object.freeze({
  DEFAULT_WARRANTY_EXPIRING_DAYS: 30,
  REPLACEMENT_COST_PERCENTAGE: 0.6, // Flag for replacement review if total maintenance cost exceeds 60% of purchase price
  FREQUENT_FAILURE_THRESHOLD: 3,
  CRITICAL_FAILURE_THRESHOLD: 4,
  MAX_RECENT_FAILURE_DAYS: 90,
  WARRANTY_NOTIFICATION_COOLDOWN_DAYS: 7,
});
