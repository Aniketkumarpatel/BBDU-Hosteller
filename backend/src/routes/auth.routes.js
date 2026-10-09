import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { registerSchema, loginSchema } from '../validators/auth.validator.js';
import env from '../config/env.js';

const router = Router();

// Public endpoints for registration allocation dropdowns
router.get('/hostels', authController.getPublicHostels);
router.get('/blocks', authController.getPublicBlocks);
router.get('/floors', authController.getPublicFloors);
router.get('/rooms', authController.getPublicRooms);

router.post('/register', authLimiter, validate(registerSchema), authController.register);
router.post('/login', authLimiter, validate(loginSchema), authController.login);
router.get('/me', requireAuth, authController.getMe);
router.post('/logout', authController.logout);

export default router;
