import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { ROLES } from '../constants/roles.js';
import {
  listSlaRules,
  getSlaRuleById,
  createSlaRule,
  updateSlaRule,
  toggleSlaRuleStatus,
  triggerSlaScheduler,
  verifySlaPipelineEndpoint,
  getSlaConfig,
  updateSlaConfig,
} from '../controllers/slaRule.controller.js';

const router = Router();

// Management is strictly restricted to SUPER_ADMIN
router.use(requireAuth, requireRole(ROLES.SUPER_ADMIN));

router.get('/', listSlaRules);
router.post('/', createSlaRule);
router.post('/run-scheduler', triggerSlaScheduler);
router.post('/verify-pipeline', verifySlaPipelineEndpoint);

// Consolidated SLA Configuration & Escalation Parameters
router.get('/config', getSlaConfig);
router.put('/config', updateSlaConfig);

router.get('/:id', getSlaRuleById);
router.patch('/:id', updateSlaRule);
router.patch('/:id/status', toggleSlaRuleStatus);

export default router;
