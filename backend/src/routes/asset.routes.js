import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { ROLES } from '../constants/roles.js';
import {
  handleCreateAsset,
  handleGetAssets,
  handleGetAssetById,
  handleUpdateAsset,
  handleMoveAsset,
  handleUpdateAssetCondition,
  handleRetireAsset,
  handleDisposeAsset,
  handleGetAssetHealth,
  handleGetAssetMaintenanceHistory,
  handleGetAssetCostAnalytics,
  handleGetInventoryDashboard,
} from '../controllers/asset.controller.js';

const router = Router();

// All asset routes require authentication
router.use(requireAuth);

// Static routes MUST precede parameterized routes (/:id)
router.get(
  '/dashboard',
  requireRole(ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN, ROLES.HOSTEL_STAFF),
  handleGetInventoryDashboard
);

router.get(
  '/analytics',
  requireRole(ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN),
  handleGetAssetCostAnalytics
);

// Asset registry list & creation
router.get('/', handleGetAssets);
router.post(
  '/',
  requireRole(ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN),
  handleCreateAsset
);

// Asset health & maintenance sub-resources
router.get(
  '/:id/health',
  requireRole(ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN, ROLES.HOSTEL_STAFF),
  handleGetAssetHealth
);

router.get('/:id/maintenance-history', handleGetAssetMaintenanceHistory);

// Single asset detail & mutations
router.get('/:id', handleGetAssetById);

router.patch(
  '/:id',
  requireRole(ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN),
  handleUpdateAsset
);

router.post(
  '/:id/move',
  requireRole(ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN),
  handleMoveAsset
);

router.post(
  '/:id/condition',
  requireRole(ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN, ROLES.HOSTEL_STAFF),
  handleUpdateAssetCondition
);

router.post(
  '/:id/retire',
  requireRole(ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN),
  handleRetireAsset
);

router.patch(
  '/:id/retire',
  requireRole(ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN),
  handleRetireAsset
);

router.post(
  '/:id/dispose',
  requireRole(ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN),
  handleDisposeAsset
);

export default router;
