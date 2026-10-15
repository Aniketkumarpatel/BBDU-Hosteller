import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { ROLES } from '../constants/roles.js';
import {
  handleSubmitFeedback,
  handleGetMyFeedbacks,
  handleGetMessFeedbacks,
  handleGetFeedbackAnalytics,
} from '../controllers/messFeedback.controller.js';

const router = Router();

router.use(requireAuth);

router.post(
  '/',
  requireRole(ROLES.STUDENT),
  handleSubmitFeedback
);

router.get(
  '/my',
  requireRole(ROLES.STUDENT),
  handleGetMyFeedbacks
);

router.get(
  '/analytics',
  handleGetFeedbackAnalytics
);

// Student names and comments: only the people who manage a mess (scoped again in the service)
router.get(
  '/',
  requireRole(ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN, ROLES.HOSTEL_STAFF),
  handleGetMessFeedbacks
);

export default router;
