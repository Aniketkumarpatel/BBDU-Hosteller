/**
 * Plain-language label maps.
 * API/DB values are unchanged — only what the user sees is simplified.
 */

export const COMPLAINT_STATUS_LABELS = {
  SUBMITTED: 'Waiting to be reviewed',
  TRIAGED: 'Reviewed & being assigned',
  ASSIGNED: 'Assigned to staff',
  ACKNOWLEDGED: 'Staff has picked this up',
  IN_PROGRESS: 'Being fixed right now',
  WAITING_FOR_INFORMATION: 'More info needed',
  RESOLVED: 'Fixed — awaiting your confirmation',
  STUDENT_VERIFICATION: 'Is it fixed? Please confirm',
  CLOSED: 'Closed',
  REOPENED: 'Reopened — needs attention',
  ESCALATED: 'Escalated to senior authority',
  REJECTED: 'Not accepted',
};

export const COMPLAINT_STATUS_FILTER_OPTIONS = [
  { value: 'SUBMITTED',           label: 'Waiting to be reviewed' },
  { value: 'TRIAGED',             label: 'Reviewed & being assigned' },
  { value: 'ASSIGNED',            label: 'Assigned to staff' },
  { value: 'ACKNOWLEDGED',        label: 'Staff has picked this up' },
  { value: 'IN_PROGRESS',         label: 'Being fixed' },
  { value: 'STUDENT_VERIFICATION',label: 'Is it fixed? (Needs your reply)' },
  { value: 'REOPENED',            label: 'Reopened' },
  { value: 'RESOLVED',            label: 'Fixed' },
  { value: 'CLOSED',              label: 'Closed' },
];

export const PRIORITY_LABELS = {
  LOW: 'Low — minor inconvenience',
  MEDIUM: 'Medium — affects daily routine',
  HIGH: 'High — disrupts daily living',
  CRITICAL: 'Critical — hazard or emergency',
};

export const PRIORITY_SHORT_LABELS = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
};

export const WORK_ORDER_STATUS_LABELS = {
  CREATED:     'New task',
  ASSIGNED:    'Assigned to staff',
  ACCEPTED:    'Staff has accepted',
  IN_PROGRESS: 'Being worked on',
  ON_HOLD:     'On hold',
  COMPLETED:   'Done',
  CANCELLED:   'Cancelled',
};

export const SLA_STATUS_LABELS = {
  ACTIVE:    'On time',
  NEAR:      'Due soon',
  BREACHED:  'Overdue',
  COMPLETED: 'Resolved',
};

/** Returns the plain label, falls back to the raw value formatted nicely */
export function getStatusLabel(status, map = COMPLAINT_STATUS_LABELS) {
  return map[status] ?? (status ?? '').replace(/_/g, ' ');
}
