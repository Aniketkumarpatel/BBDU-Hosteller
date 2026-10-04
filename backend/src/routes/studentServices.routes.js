import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { ROLES } from '../constants/roles.js';
import {
  handleGetNotices,
  handleGetNoticeById,
  handleCreateNotice,
  handleUpdateNotice,
  handlePublishNotice,
  handleAcknowledgeNotice,
  handleDeleteNotice,
  handleGetServiceRequests,
  handleGetServiceRequestById,
  handleCreateServiceRequest,
  handleAssignServiceRequest,
  handleUpdateServiceRequestStatus,
  handleVerifyServiceRequest,
  handleGetHostelContacts,
  handleCreateHostelContact,
  handleUpdateHostelContact,
  handleDeleteHostelContact,
  handleGetStudentFeedback,
  handleSubmitStudentFeedback,
  handleRespondToStudentFeedback,
  handleGetStudentServicesStats,
  handleRunLifecycleJobs,
} from '../controllers/studentServices.controller.js';

const router = Router();

// All endpoints in this module require authentication
router.use(requireAuth);

// ----------------------------------------------------------------------------
// Operational Stats & Lifecycle Job
// ----------------------------------------------------------------------------
router.get('/stats', handleGetStudentServicesStats);
router.post(
  '/lifecycle/run',
  requireRole(ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN),
  handleRunLifecycleJobs
);

// ----------------------------------------------------------------------------
// Digital Notices & Bulletins
// ----------------------------------------------------------------------------
router.get('/notices', handleGetNotices);
router.get('/notices/:id', handleGetNoticeById);
router.post(
  '/notices',
  requireRole(ROLES.WARDEN, ROLES.AUTHORITY, ROLES.SUPER_ADMIN),
  handleCreateNotice
);
router.put(
  '/notices/:id',
  requireRole(ROLES.WARDEN, ROLES.AUTHORITY, ROLES.SUPER_ADMIN),
  handleUpdateNotice
);
router.post(
  '/notices/:id/publish',
  requireRole(ROLES.WARDEN, ROLES.AUTHORITY, ROLES.SUPER_ADMIN),
  handlePublishNotice
);
router.post('/notices/:id/acknowledge', handleAcknowledgeNotice);
router.delete(
  '/notices/:id',
  requireRole(ROLES.WARDEN, ROLES.AUTHORITY, ROLES.SUPER_ADMIN),
  handleDeleteNotice
);

// ----------------------------------------------------------------------------
// Student Service Requests
// ----------------------------------------------------------------------------
router.get('/requests', handleGetServiceRequests);
router.get('/requests/:id', handleGetServiceRequestById);
router.post(
  '/requests',
  requireRole(ROLES.STUDENT, ROLES.WARDEN, ROLES.SUPER_ADMIN),
  handleCreateServiceRequest
);
router.post(
  '/requests/:id/assign',
  requireRole(ROLES.WARDEN, ROLES.AUTHORITY, ROLES.SUPER_ADMIN),
  handleAssignServiceRequest
);
router.patch('/requests/:id/status', handleUpdateServiceRequestStatus);
router.post(
  '/requests/:id/verify',
  requireRole(ROLES.STUDENT),
  handleVerifyServiceRequest
);

// ----------------------------------------------------------------------------
// Hostel Contact Directory
// ----------------------------------------------------------------------------
router.get('/contacts', handleGetHostelContacts);
router.post(
  '/contacts',
  requireRole(ROLES.WARDEN, ROLES.AUTHORITY, ROLES.SUPER_ADMIN),
  handleCreateHostelContact
);
router.put(
  '/contacts/:id',
  requireRole(ROLES.WARDEN, ROLES.AUTHORITY, ROLES.SUPER_ADMIN),
  handleUpdateHostelContact
);
router.delete(
  '/contacts/:id',
  requireRole(ROLES.WARDEN, ROLES.AUTHORITY, ROLES.SUPER_ADMIN),
  handleDeleteHostelContact
);

// ----------------------------------------------------------------------------
// Student Feedback
// ----------------------------------------------------------------------------
router.get('/feedback', handleGetStudentFeedback);
router.post(
  '/feedback',
  requireRole(ROLES.STUDENT),
  handleSubmitStudentFeedback
);
router.post(
  '/feedback/:id/respond',
  requireRole(ROLES.WARDEN, ROLES.AUTHORITY, ROLES.SUPER_ADMIN),
  handleRespondToStudentFeedback
);

export default router;
