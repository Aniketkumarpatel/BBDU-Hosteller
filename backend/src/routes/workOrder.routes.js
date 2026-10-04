import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { ROLES } from '../constants/roles.js';
import {
  handleCreateWorkOrder,
  handleGetWorkOrders,
  handleGetWorkOrderStats,
  handleGetWorkOrderById,
  handleUpdateWorkOrder,
  handleAssignWorkOrder,
  handleReassignWorkOrder,
  handleAcceptWorkOrder,
  handleStartWorkOrder,
  handleHoldWorkOrder,
  handleResumeWorkOrder,
  handleCompleteWorkOrder,
  handleCancelWorkOrder,
} from '../controllers/workOrder.controller.js';

const router = Router();

// Work Order operations require authentication
router.use(requireAuth);

// Operational and administrative endpoints
router.get('/stats', requireRole(ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN, ROLES.HOSTEL_STAFF), handleGetWorkOrderStats);

router.get('/', requireRole(ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN, ROLES.HOSTEL_STAFF), handleGetWorkOrders);

router.post('/', requireRole(ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN, ROLES.HOSTEL_STAFF), handleCreateWorkOrder);

// Detail endpoint (Students allowed if linked to their complaint, verified in controller)
router.get('/:id', handleGetWorkOrderById);

router.patch('/:id', requireRole(ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN, ROLES.HOSTEL_STAFF), handleUpdateWorkOrder);

router.post('/:id/assign', requireRole(ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN), handleAssignWorkOrder);
router.patch('/:id/assign', requireRole(ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN), handleAssignWorkOrder);

router.post('/:id/reassign', requireRole(ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN), handleReassignWorkOrder);
router.patch('/:id/reassign', requireRole(ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN), handleReassignWorkOrder);

router.post('/:id/accept', requireRole(ROLES.SUPER_ADMIN, ROLES.WARDEN, ROLES.HOSTEL_STAFF), handleAcceptWorkOrder);
router.patch('/:id/accept', requireRole(ROLES.SUPER_ADMIN, ROLES.WARDEN, ROLES.HOSTEL_STAFF), handleAcceptWorkOrder);

router.post('/:id/start', requireRole(ROLES.SUPER_ADMIN, ROLES.WARDEN, ROLES.HOSTEL_STAFF), handleStartWorkOrder);
router.patch('/:id/start', requireRole(ROLES.SUPER_ADMIN, ROLES.WARDEN, ROLES.HOSTEL_STAFF), handleStartWorkOrder);

router.post('/:id/hold', requireRole(ROLES.SUPER_ADMIN, ROLES.WARDEN, ROLES.HOSTEL_STAFF), handleHoldWorkOrder);
router.patch('/:id/hold', requireRole(ROLES.SUPER_ADMIN, ROLES.WARDEN, ROLES.HOSTEL_STAFF), handleHoldWorkOrder);

router.post('/:id/resume', requireRole(ROLES.SUPER_ADMIN, ROLES.WARDEN, ROLES.HOSTEL_STAFF), handleResumeWorkOrder);
router.patch('/:id/resume', requireRole(ROLES.SUPER_ADMIN, ROLES.WARDEN, ROLES.HOSTEL_STAFF), handleResumeWorkOrder);

router.post('/:id/complete', requireRole(ROLES.SUPER_ADMIN, ROLES.WARDEN, ROLES.HOSTEL_STAFF), handleCompleteWorkOrder);
router.patch('/:id/complete', requireRole(ROLES.SUPER_ADMIN, ROLES.WARDEN, ROLES.HOSTEL_STAFF), handleCompleteWorkOrder);

router.post('/:id/cancel', requireRole(ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN), handleCancelWorkOrder);
router.patch('/:id/cancel', requireRole(ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN), handleCancelWorkOrder);

export default router;
