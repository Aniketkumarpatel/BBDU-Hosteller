import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { ROLES } from '../constants/roles.js';
import {
  listEscalationRules,
  getEscalationRuleById,
  createEscalationRule,
  updateEscalationRule,
  toggleEscalationRuleStatus,
} from '../controllers/slaRule.controller.js';

const router = Router();

// Management is strictly restricted to SUPER_ADMIN
router.use(requireAuth, requireRole(ROLES.SUPER_ADMIN));

router.get('/', listEscalationRules);
router.post('/', createEscalationRule);
router.get('/:id', getEscalationRuleById);
router.patch('/:id', updateEscalationRule);
router.patch('/:id/status', toggleEscalationRuleStatus);

export default router;
