import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { ROLES } from '../constants/roles.js';
import {
  getComplaintMeta,
  listComplaints,
  submitComplaint,
  getMyComplaints,
  getComplaintDetails,
  triageComplaint,
  getEligibleAssignees,
  assignComplaint,
  reassignComplaint,
  acknowledgeComplaint,
  startWorkOnComplaint,
  getComplaintAssignments,
  resolveComplaint,
  verifyComplaint,
  resumeWorkOnComplaint,
  getComplaintResolutions,
  getComplaintSla,
  getComplaintEscalations,
} from '../controllers/complaint.controller.js';

import { handleComplaintUpload } from '../middleware/upload.js';

const router = Router();

// Metadata constants endpoint (authenticated)
router.get('/meta', requireAuth, getComplaintMeta);

// Student complaints retrieval
router.get('/my', requireAuth, requireRole(ROLES.STUDENT), getMyComplaints);

// Student complaint creation
router.post('/', requireAuth, requireRole(ROLES.STUDENT), handleComplaintUpload, submitComplaint);

// Operational complaints listing (Warden, Staff, Authority, Super Admin)
router.get(
  '/',
  requireAuth,
  requireRole(ROLES.WARDEN, ROLES.HOSTEL_STAFF, ROLES.AUTHORITY, ROLES.SUPER_ADMIN),
  listComplaints
);

// Single complaint retrieval (all roles permitted subject to internal scope checks)
router.get('/:id', requireAuth, getComplaintDetails);

// Eligible assignees query
router.get(
  '/:id/eligible-assignees',
  requireAuth,
  requireRole(ROLES.WARDEN, ROLES.AUTHORITY, ROLES.SUPER_ADMIN),
  getEligibleAssignees
);

// Chronological assignment audit history
router.get(
  '/:id/assignments',
  requireAuth,
  requireRole(ROLES.WARDEN, ROLES.HOSTEL_STAFF, ROLES.AUTHORITY, ROLES.SUPER_ADMIN),
  getComplaintAssignments
);

// Chronological resolution & verification history
router.get('/:id/resolutions', requireAuth, getComplaintResolutions);

// SLA cycle and real-time monitoring details
router.get('/:id/sla', requireAuth, getComplaintSla);

// Chronological escalation history
router.get('/:id/escalations', requireAuth, getComplaintEscalations);

// Triage complaint (SUBMITTED -> TRIAGED)
router.patch(
  '/:id/triage',
  requireAuth,
  requireRole(ROLES.WARDEN, ROLES.AUTHORITY, ROLES.SUPER_ADMIN),
  triageComplaint
);

// Assign complaint (TRIAGED -> ASSIGNED)
router.patch(
  '/:id/assign',
  requireAuth,
  requireRole(ROLES.WARDEN, ROLES.AUTHORITY, ROLES.SUPER_ADMIN),
  assignComplaint
);

// Reassign complaint (ASSIGNED / ACKNOWLEDGED / IN_PROGRESS -> ASSIGNED with new assignee)
router.patch(
  '/:id/reassign',
  requireAuth,
  requireRole(ROLES.WARDEN, ROLES.AUTHORITY, ROLES.SUPER_ADMIN),
  reassignComplaint
);

// Acknowledge complaint (ASSIGNED -> ACKNOWLEDGED)
router.patch('/:id/acknowledge', requireAuth, acknowledgeComplaint);

// Start work on complaint (ACKNOWLEDGED -> IN_PROGRESS)
router.patch('/:id/start', requireAuth, startWorkOnComplaint);

// Resolve complaint (IN_PROGRESS -> STUDENT_VERIFICATION)
router.patch(
  '/:id/resolve',
  requireAuth,
  requireRole(ROLES.HOSTEL_STAFF, ROLES.WARDEN, ROLES.AUTHORITY, ROLES.SUPER_ADMIN),
  resolveComplaint
);

// Student verify complaint (STUDENT_VERIFICATION -> CLOSED or REOPENED)
router.patch(
  '/:id/verify',
  requireAuth,
  requireRole(ROLES.STUDENT, ROLES.SUPER_ADMIN),
  verifyComplaint
);

// Resume work on reopened complaint (REOPENED -> IN_PROGRESS)
router.patch(
  '/:id/resume',
  requireAuth,
  requireRole(ROLES.HOSTEL_STAFF, ROLES.WARDEN, ROLES.AUTHORITY, ROLES.SUPER_ADMIN),
  resumeWorkOnComplaint
);

export default router;
