import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { ROLES } from '../constants/roles.js';
import {
  handleCreateOutpassRequest,
  handleGetOutpasses,
  handleGetOutpassById,
  handleApproveOutpass,
  handleRejectOutpass,
  handleCancelOutpass,
  handleVerifyExit,
  handleVerifyReturn,
  handleGetDigitalPass,
  handleVerifyPassToken,
  handleGetOutpassStats,
  handleRunOverdueOutpassCheck,
  handleRequestVisitor,
  handleGetVisitors,
  handleGetVisitorById,
  handleApproveVisitor,
  handleCheckInVisitor,
  handleCheckOutVisitor,
  handleRejectVisitor,
} from '../controllers/outpass.controller.js';

const router = Router();

router.use(requireAuth);

// Operational Dashboard & Scheduler
router.get(
  '/dashboard',
  requireRole(ROLES.WARDEN, ROLES.AUTHORITY, ROLES.SUPER_ADMIN, ROLES.HOSTEL_STAFF),
  handleGetOutpassStats
);

router.post(
  '/scheduler/run',
  requireRole(ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN),
  handleRunOverdueOutpassCheck
);

// QR / Digital Pass Token Verification (Gate Scanner)
router.post('/verify-token', handleVerifyPassToken);

// Visitor Operations
router.get('/visitors', handleGetVisitors);
router.post(
  '/visitors',
  requireRole(ROLES.STUDENT, ROLES.HOSTEL_STAFF, ROLES.WARDEN, ROLES.SUPER_ADMIN),
  handleRequestVisitor
);
router.get('/visitors/:id', handleGetVisitorById);
router.post(
  '/visitors/:id/approve',
  requireRole(ROLES.WARDEN, ROLES.AUTHORITY, ROLES.SUPER_ADMIN),
  handleApproveVisitor
);
router.post(
  '/visitors/:id/check-in',
  requireRole(ROLES.HOSTEL_STAFF, ROLES.WARDEN, ROLES.SUPER_ADMIN),
  handleCheckInVisitor
);
router.post(
  '/visitors/:id/check-out',
  requireRole(ROLES.HOSTEL_STAFF, ROLES.WARDEN, ROLES.SUPER_ADMIN),
  handleCheckOutVisitor
);
router.post(
  '/visitors/:id/reject',
  requireRole(ROLES.WARDEN, ROLES.AUTHORITY, ROLES.SUPER_ADMIN),
  handleRejectVisitor
);

// Student Outpass Operations
router.get('/', handleGetOutpasses);
router.post('/', requireRole(ROLES.STUDENT), handleCreateOutpassRequest);
router.get('/:id', handleGetOutpassById);
router.get('/:id/digital-pass', handleGetDigitalPass);

router.post(
  '/:id/approve',
  requireRole(ROLES.WARDEN, ROLES.AUTHORITY, ROLES.SUPER_ADMIN),
  handleApproveOutpass
);

router.post(
  '/:id/reject',
  requireRole(ROLES.WARDEN, ROLES.AUTHORITY, ROLES.SUPER_ADMIN),
  handleRejectOutpass
);

router.post(
  '/:id/cancel',
  requireRole(ROLES.STUDENT, ROLES.WARDEN, ROLES.SUPER_ADMIN),
  handleCancelOutpass
);

// Gate Verifications
router.post(
  '/:id/verify-exit',
  requireRole(ROLES.HOSTEL_STAFF, ROLES.WARDEN, ROLES.SUPER_ADMIN),
  handleVerifyExit
);

router.post(
  '/:id/verify-return',
  requireRole(ROLES.HOSTEL_STAFF, ROLES.WARDEN, ROLES.SUPER_ADMIN),
  handleVerifyReturn
);

export default router;
