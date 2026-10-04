import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { ROLES } from '../constants/roles.js';
import {
  handleCreateMess,
  handleGetMesses,
  handleGetMessById,
  handleUpdateMess,
  handleCreateOrUpdateMenu,
  handleGetMenus,
  handleGetTodayMenu,
  handlePublishMenu,
  handleUnpublishMenu,
  handleGetMessDashboard,
  handleGetFoodQualityAnalytics,
} from '../controllers/mess.controller.js';

const router = Router();

router.use(requireAuth);

// Operational Dashboard & Analytics
router.get('/dashboard', handleGetMessDashboard);
router.get('/analytics', handleGetFoodQualityAnalytics);

// Mess Entities
router.get('/', handleGetMesses);
router.post(
  '/',
  requireRole(ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN),
  handleCreateMess
);

router.get('/:id', handleGetMessById);
router.patch(
  '/:id',
  requireRole(ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN),
  handleUpdateMess
);

// Menus within Mess
router.get('/:messId/menus', handleGetMenus);
router.get('/:messId/menus/today', handleGetTodayMenu);
router.post(
  '/:messId/menus',
  requireRole(ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN, ROLES.HOSTEL_STAFF),
  handleCreateOrUpdateMenu
);

// Menu Publishing Actions
router.post(
  '/menus/:id/publish',
  requireRole(ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN, ROLES.HOSTEL_STAFF),
  handlePublishMenu
);
router.patch(
  '/menus/:id/publish',
  requireRole(ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN, ROLES.HOSTEL_STAFF),
  handlePublishMenu
);

router.post(
  '/menus/:id/unpublish',
  requireRole(ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN, ROLES.HOSTEL_STAFF),
  handleUnpublishMenu
);
router.patch(
  '/menus/:id/unpublish',
  requireRole(ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN, ROLES.HOSTEL_STAFF),
  handleUnpublishMenu
);

export default router;
