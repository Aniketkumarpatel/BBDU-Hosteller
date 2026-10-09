import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { requireAuth, requireAuthAllowPasswordChange, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { registerSchema, loginSchema, changePasswordSchema } from '../validators/auth.validator.js';
import { ROLES } from '../constants/roles.js';
import env from '../config/env.js';

const router = Router();

// Public endpoints for registration allocation dropdowns
router.get('/hostels', authController.getPublicHostels);
router.get('/blocks', authController.getPublicBlocks);
router.get('/floors', authController.getPublicFloors);
router.get('/rooms', authController.getPublicRooms);

router.post('/register', authLimiter, validate(registerSchema), authController.register);
router.post('/login', authLimiter, validate(loginSchema), authController.login);
// /me and /change-password stay reachable while a forced password change is pending
router.get('/me', requireAuthAllowPasswordChange, authController.getMe);
router.post(
  '/change-password',
  authLimiter,
  requireAuthAllowPasswordChange,
  validate(changePasswordSchema),
  authController.changePassword
);
router.get('/hostel-users', requireAuth, requireRole(ROLES.WARDEN), authController.listHostelUsers);
router.post(
  '/users/:id/reset-password',
  requireAuth,
  requireRole(ROLES.SUPER_ADMIN, ROLES.WARDEN),
  authController.resetPassword
);
router.post('/logout', authController.logout);

export default router;
