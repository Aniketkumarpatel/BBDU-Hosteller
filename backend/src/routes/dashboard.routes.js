import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getDashboardStats } from '../controllers/dashboard.controller.js';

const router = Router();

// Protected for all authenticated roles
router.use(requireAuth);

router.get('/stats', getDashboardStats);

export default router;
