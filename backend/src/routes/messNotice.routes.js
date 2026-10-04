import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { ROLES } from '../constants/roles.js';
import {
  handleCreateNotice,
  handleGetNotices,
  handleToggleNoticeActive,
} from '../controllers/messNotice.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/', handleGetNotices);

router.post(
  '/',
  requireRole(ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN, ROLES.HOSTEL_STAFF),
  handleCreateNotice
);

router.patch(
  '/:id/toggle',
  requireRole(ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN, ROLES.HOSTEL_STAFF),
  handleToggleNoticeActive
);

export default router;
