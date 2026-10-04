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

router.get(
  '/',
  handleGetMessFeedbacks
);

export default router;
