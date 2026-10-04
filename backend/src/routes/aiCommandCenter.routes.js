import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { ROLES } from '../constants/roles.js';
import {
  handleGetOverview,
  handleGetHealthScore,
  handleGetInsights,
  handleGetRecommendations,
  handleAskAssistant,
} from '../controllers/aiCommandCenter.controller.js';

import { aiQueryLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// Strictly restricted to WARDEN, AUTHORITY, and SUPER_ADMIN
// Both STUDENT and HOSTEL_STAFF are denied with 403 Forbidden
router.use(requireAuth);
router.use(requireRole(ROLES.WARDEN, ROLES.AUTHORITY, ROLES.SUPER_ADMIN));

router.get('/overview', handleGetOverview);
router.get('/health-score', handleGetHealthScore);
router.get('/insights', handleGetInsights);
router.get('/recommendations', handleGetRecommendations);
router.post('/ask', aiQueryLimiter, handleAskAssistant);
router.get('/ask', aiQueryLimiter, handleAskAssistant);

export default router;
