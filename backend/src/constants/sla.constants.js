/**
 * Controlled constants for SLA & Escalation Engine
 */

export const SLA_STATUSES = Object.freeze({
  ACTIVE: 'ACTIVE',
  BREACHED: 'BREACHED',
  PAUSED: 'PAUSED',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
});

export const SLA_STATUS_VALUES = Object.freeze(Object.values(SLA_STATUSES));

export const ESCALATION_TRIGGERS = Object.freeze({
  AUTOMATIC_SLA_BREACH: 'AUTOMATIC_SLA_BREACH',
  MANUAL_ADMIN: 'MANUAL_ADMIN',
  SYSTEM: 'SYSTEM',
});

export const ESCALATION_TRIGGER_VALUES = Object.freeze(Object.values(ESCALATION_TRIGGERS));

export const DEFAULT_SLA_DURATIONS_HOURS = Object.freeze({
  CRITICAL: 4,
  HIGH: 24,
  MEDIUM: 48,
  LOW: 72,
});

export const DEFAULT_REMINDER_THRESHOLD_PERCENT = 75;
