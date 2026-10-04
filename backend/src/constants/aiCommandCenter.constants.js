/**
 * Controlled constants for AI Hostel Command Center & Smart Operations (Step 13)
 */

export const INSIGHT_CATEGORIES = Object.freeze({
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
  INFO: 'INFO',
});

export const INSIGHT_CATEGORY_VALUES = Object.freeze(Object.values(INSIGHT_CATEGORIES));

export const INSIGHT_MODULES = Object.freeze({
  COMPLAINTS: 'COMPLAINTS',
  MAINTENANCE: 'MAINTENANCE',
  PREVENTIVE: 'PREVENTIVE',
  CLEANING: 'CLEANING',
  MESS: 'MESS',
  OUTPASS: 'OUTPASS',
  WORKLOAD: 'WORKLOAD',
  GENERAL: 'GENERAL',
});

export const INSIGHT_MODULE_VALUES = Object.freeze(Object.values(INSIGHT_MODULES));

export const HEALTH_SCORE_BANDS = Object.freeze({
  OPTIMAL: 'OPTIMAL',
  MODERATE_RISK: 'MODERATE_RISK',
  HIGH_RISK: 'HIGH_RISK',
  CRITICAL: 'CRITICAL',
});
