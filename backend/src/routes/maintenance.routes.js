import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { ROLES } from '../constants/roles.js';
import {
  handleGetPreventiveDashboard,
  handleGetUpcomingMaintenance,
  handleGetDueMaintenance,
  handleGetOverdueMaintenance,
  handleTriggerMaintenanceScheduler,
} from '../controllers/preventiveMaintenance.controller.js';

const router = Router();

// Authentication required
router.use(requireAuth);

router.get(
  '/dashboard',
  requireRole(ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN, ROLES.HOSTEL_STAFF),
  handleGetPreventiveDashboard
);

router.get(
  '/upcoming',
  requireRole(ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN, ROLES.HOSTEL_STAFF),
  handleGetUpcomingMaintenance
);

router.get(
  '/due',
  requireRole(ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN, ROLES.HOSTEL_STAFF),
  handleGetDueMaintenance
);

router.get(
  '/overdue',
  requireRole(ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN, ROLES.HOSTEL_STAFF),
  handleGetOverdueMaintenance
);

// Manual trigger for testing/admin verification
router.post(
  '/trigger',
  requireRole(ROLES.SUPER_ADMIN),
  handleTriggerMaintenanceScheduler
);

export default router;
