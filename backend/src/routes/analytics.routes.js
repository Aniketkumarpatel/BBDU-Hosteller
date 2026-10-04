import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { ROLES } from '../constants/roles.js';
import {
  getOverview,
  getTrends,
  getStatusStats,
  getCategories,
  getPriorities,
  getDepartments,
  getHostels,
  getSla,
  getEscalations,
  getWorkload,
  exportCsv,
} from '../controllers/analytics.controller.js';

import { analyticsLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// Operational intelligence is strictly restricted to staff, wardens, authorities, and super admins.
// Students are strictly forbidden (403).
router.use(
  requireAuth,
  requireRole(ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN, ROLES.HOSTEL_STAFF),
  analyticsLimiter
);

router.get('/overview', getOverview);
router.get('/trends', getTrends);
router.get('/status-distribution', getStatusStats);
router.get('/categories', getCategories);
router.get('/priorities', getPriorities);
router.get('/departments', getDepartments);
router.get('/hostels', getHostels);
router.get('/sla', getSla);
router.get('/escalations', getEscalations);
router.get('/workload', getWorkload);
router.get('/export', exportCsv);

export default router;
