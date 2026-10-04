import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { ROLES } from '../constants/roles.js';
import {
  handleCreateCleaningArea,
  handleGetCleaningAreas,
  handleGetCleaningAreaById,
  handleUpdateCleaningArea,
  handleCreateCleaningPlan,
  handleGetCleaningPlans,
  handleGetCleaningPlanById,
  handleUpdateCleaningPlan,
  handleToggleCleaningPlanStatus,
  handleCreateTask,
  handleGetTasks,
  handleGetTaskById,
  handleAssignTask,
  handleAcceptTask,
  handleStartTask,
  handleHoldTask,
  handleResumeTask,
  handleCompleteTask,
  handleVerifyTask,
  handleRejectTask,
  handleCancelTask,
  handleRunCleaningScheduler,
  handleGetCleaningDashboardStats,
} from '../controllers/cleaning.controller.js';

const router = Router();

router.use(requireAuth);

// Operational Dashboard
router.get('/dashboard', handleGetCleaningDashboardStats);

// Manual Scheduler Trigger
router.post(
  '/scheduler/run',
  requireRole(ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN),
  handleRunCleaningScheduler
);

// Cleaning Areas
router.get('/areas', handleGetCleaningAreas);
router.post(
  '/areas',
  requireRole(ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN),
  handleCreateCleaningArea
);
router.get('/areas/:id', handleGetCleaningAreaById);
router.patch(
  '/areas/:id',
  requireRole(ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN),
  handleUpdateCleaningArea
);

// Cleaning Plans
router.get('/plans', handleGetCleaningPlans);
router.post(
  '/plans',
  requireRole(ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN),
  handleCreateCleaningPlan
);
router.get('/plans/:id', handleGetCleaningPlanById);
router.patch(
  '/plans/:id',
  requireRole(ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN),
  handleUpdateCleaningPlan
);
router.patch(
  '/plans/:id/status',
  requireRole(ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN),
  handleToggleCleaningPlanStatus
);

// Cleaning Tasks
router.get('/tasks', handleGetTasks);
router.post(
  '/tasks',
  requireRole(ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN, ROLES.HOSTEL_STAFF),
  handleCreateTask
);
router.get('/tasks/:id', handleGetTaskById);
router.post(
  '/tasks/:id/assign',
  requireRole(ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN),
  handleAssignTask
);
router.post(
  '/tasks/:id/accept',
  requireRole(ROLES.HOSTEL_STAFF, ROLES.WARDEN, ROLES.SUPER_ADMIN),
  handleAcceptTask
);
router.post(
  '/tasks/:id/start',
  requireRole(ROLES.HOSTEL_STAFF, ROLES.WARDEN, ROLES.SUPER_ADMIN),
  handleStartTask
);
router.post(
  '/tasks/:id/hold',
  requireRole(ROLES.HOSTEL_STAFF, ROLES.WARDEN, ROLES.SUPER_ADMIN),
  handleHoldTask
);
router.post(
  '/tasks/:id/resume',
  requireRole(ROLES.HOSTEL_STAFF, ROLES.WARDEN, ROLES.SUPER_ADMIN),
  handleResumeTask
);
router.post(
  '/tasks/:id/complete',
  requireRole(ROLES.HOSTEL_STAFF, ROLES.WARDEN, ROLES.SUPER_ADMIN),
  handleCompleteTask
);
router.post(
  '/tasks/:id/verify',
  requireRole(ROLES.WARDEN, ROLES.AUTHORITY, ROLES.SUPER_ADMIN),
  handleVerifyTask
);
router.post(
  '/tasks/:id/reject',
  requireRole(ROLES.WARDEN, ROLES.AUTHORITY, ROLES.SUPER_ADMIN),
  handleRejectTask
);
router.post(
  '/tasks/:id/cancel',
  requireRole(ROLES.WARDEN, ROLES.AUTHORITY, ROLES.SUPER_ADMIN),
  handleCancelTask
);

export default router;
