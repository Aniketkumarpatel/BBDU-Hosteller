import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { ROLES } from '../constants/roles.js';
import {
  handleCreateMaintenancePlan,
  handleGetMaintenancePlans,
  handleGetMaintenancePlanById,
  handleUpdateMaintenancePlan,
  handlePauseMaintenancePlan,
  handleResumeMaintenancePlan,
  handleDeactivateMaintenancePlan,
  handleGetPlanCycles,
} from '../controllers/preventiveMaintenance.controller.js';

const router = Router();

// Authentication required for all maintenance plan endpoints
router.use(requireAuth);

// Plan listing & detail (Staff, Warden, Authority, Super Admin)
router.get(
  '/',
  requireRole(ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN, ROLES.HOSTEL_STAFF),
  handleGetMaintenancePlans
);

router.post(
  '/',
  requireRole(ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN),
  handleCreateMaintenancePlan
);

router.get(
  '/:id',
  requireRole(ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN, ROLES.HOSTEL_STAFF),
  handleGetMaintenancePlanById
);

router.patch(
  '/:id',
  requireRole(ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN),
  handleUpdateMaintenancePlan
);

router.post(
  '/:id/pause',
  requireRole(ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN),
  handlePauseMaintenancePlan
);
router.patch(
  '/:id/pause',
  requireRole(ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN),
  handlePauseMaintenancePlan
);

router.post(
  '/:id/resume',
  requireRole(ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN),
  handleResumeMaintenancePlan
);
router.patch(
  '/:id/resume',
  requireRole(ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN),
  handleResumeMaintenancePlan
);

router.post(
  '/:id/deactivate',
  requireRole(ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN),
  handleDeactivateMaintenancePlan
);
router.patch(
  '/:id/deactivate',
  requireRole(ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN),
  handleDeactivateMaintenancePlan
);

router.get(
  '/:id/cycles',
  requireRole(ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN, ROLES.HOSTEL_STAFF),
  handleGetPlanCycles
);

export default router;
