import asyncHandler from '../utils/asyncHandler.js';
import { SlaRule, EscalationRule } from '../models/index.js';
import { runSlaSchedulerOnce } from '../scheduler/slaScheduler.js';
import { runLivePipelineVerification } from '../services/sla.service.js';

// ==================== SLA RULES ====================

/**
 * GET /api/sla-rules
 * List all SLA rules with optional filtering
 */
export const listSlaRules = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.priority) filter.priority = req.query.priority;
  if (req.query.category) filter.category = req.query.category;
  if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';

  if (req.query.search) {
    const q = req.query.search.trim();
    filter.$or = [
      { name: { $regex: q, $options: 'i' } },
      { code: { $regex: q, $options: 'i' } },
    ];
  }

  const rules = await SlaRule.find(filter)
    .populate('departmentId', 'name code')
    .sort({ priority: 1, resolutionHours: 1 });

  return res.status(200).json({
    success: true,
    count: rules.length,
    data: rules,
  });
});

/**
 * GET /api/sla-rules/:id
 */
export const getSlaRuleById = asyncHandler(async (req, res) => {
  const rule = await SlaRule.findById(req.params.id).populate('departmentId', 'name code');
  if (!rule) {
    return res.status(404).json({ success: false, message: 'SLA Rule not found' });
  }

  return res.status(200).json({
    success: true,
    data: rule,
  });
});

/**
 * POST /api/sla-rules
 */
export const createSlaRule = asyncHandler(async (req, res) => {
  const {
    name,
    code,
    description,
    category,
    priority,
    departmentId,
    initialResponseHours,
    resolutionHours,
    reminderThresholdPercent,
    escalationEnabled,
    escalationAfterHours,
    isActive,
  } = req.body;

  if (!name || !code || !priority || !resolutionHours) {
    return res.status(400).json({
      success: false,
      message: 'Name, code, priority, and resolutionHours are required',
    });
  }

  const normalizedCode = code.trim().toUpperCase();
  const existing = await SlaRule.findOne({ code: normalizedCode });
  if (existing) {
    return res.status(409).json({
      success: false,
      message: `An SLA rule with code '${normalizedCode}' already exists`,
    });
  }

  const rule = await SlaRule.create({
    name: name.trim(),
    code: normalizedCode,
    description: description?.trim() || '',
    category: category || null,
    priority,
    departmentId: departmentId || null,
    initialResponseHours: initialResponseHours !== undefined ? Number(initialResponseHours) : 2,
    resolutionHours: Number(resolutionHours),
    reminderThresholdPercent:
      reminderThresholdPercent !== undefined ? Number(reminderThresholdPercent) : 75,
    escalationEnabled: escalationEnabled !== undefined ? Boolean(escalationEnabled) : true,
    escalationAfterHours:
      escalationAfterHours !== undefined ? Number(escalationAfterHours) : 0,
    isActive: isActive !== undefined ? Boolean(isActive) : true,
    createdBy: req.user._id,
    updatedBy: req.user._id,
  });

  return res.status(201).json({
    success: true,
    message: 'SLA Rule created successfully',
    data: rule,
  });
});

/**
 * PATCH /api/sla-rules/:id
 */
export const updateSlaRule = asyncHandler(async (req, res) => {
  const rule = await SlaRule.findById(req.params.id);
  if (!rule) {
    return res.status(404).json({ success: false, message: 'SLA Rule not found' });
  }

  const allowedFields = [
    'name',
    'description',
    'category',
    'priority',
    'departmentId',
    'initialResponseHours',
    'resolutionHours',
    'reminderThresholdPercent',
    'escalationEnabled',
    'escalationAfterHours',
    'isActive',
  ];

  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      rule[field] = req.body[field];
    }
  }

  rule.updatedBy = req.user._id;
  await rule.save();

  return res.status(200).json({
    success: true,
    message: 'SLA Rule updated successfully',
    data: rule,
  });
});

/**
 * PATCH /api/sla-rules/:id/status
 */
export const toggleSlaRuleStatus = asyncHandler(async (req, res) => {
  const rule = await SlaRule.findById(req.params.id);
  if (!rule) {
    return res.status(404).json({ success: false, message: 'SLA Rule not found' });
  }

  rule.isActive = req.body.isActive !== undefined ? Boolean(req.body.isActive) : !rule.isActive;
  rule.updatedBy = req.user._id;
  await rule.save();

  return res.status(200).json({
    success: true,
    message: `SLA Rule ${rule.isActive ? 'activated' : 'deactivated'} successfully`,
    data: rule,
  });
});

/**
 * POST /api/sla-rules/run-scheduler
 * Trigger manual scheduler cycle for testing / verification
 */
export const triggerSlaScheduler = asyncHandler(async (req, res) => {
  const results = await runSlaSchedulerOnce();
  return res.status(200).json({
    success: true,
    message: 'SLA scheduler cycle executed',
    data: results,
  });
});

/**
 * POST /api/sla-rules/verify-pipeline
 * Step 5.5: Run a full live pipeline diagnostic verification pass for SLA & Automatic Escalation
 */
export const verifySlaPipelineEndpoint = asyncHandler(async (req, res) => {
  const result = await runLivePipelineVerification();
  return res.status(200).json({
    success: true,
    message: result.summary,
    data: result,
  });
});

// ==================== ESCALATION RULES ====================

/**
 * GET /api/escalation-rules
 */
export const listEscalationRules = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.escalationLevel) filter.escalationLevel = Number(req.query.escalationLevel);
  if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';

  const rules = await EscalationRule.find(filter)
    .populate('fromDepartmentId', 'name code')
    .populate('toDepartmentId', 'name code')
    .populate('hostelId', 'name code')
    .populate('nextAuthorityUserId', 'name email role')
    .sort({ escalationLevel: 1 });

  return res.status(200).json({
    success: true,
    count: rules.length,
    data: rules,
  });
});

/**
 * GET /api/escalation-rules/:id
 */
export const getEscalationRuleById = asyncHandler(async (req, res) => {
  const rule = await EscalationRule.findById(req.params.id)
    .populate('fromDepartmentId', 'name code')
    .populate('toDepartmentId', 'name code')
    .populate('hostelId', 'name code')
    .populate('nextAuthorityUserId', 'name email role');

  if (!rule) {
    return res.status(404).json({ success: false, message: 'Escalation Rule not found' });
  }

  return res.status(200).json({
    success: true,
    data: rule,
  });
});

/**
 * POST /api/escalation-rules
 */
export const createEscalationRule = asyncHandler(async (req, res) => {
  const {
    name,
    code,
    escalationLevel,
    fromRole,
    toRole,
    fromDepartmentId,
    toDepartmentId,
    hostelId,
    priority,
    nextAuthorityRole,
    nextAuthorityUserId,
    escalationAfterHours,
    resolutionHours,
    isActive,
  } = req.body;

  if (!name || !code || !escalationLevel || !fromRole || !toRole) {
    return res.status(400).json({
      success: false,
      message: 'Name, code, escalationLevel, fromRole, and toRole are required',
    });
  }

  const normalizedCode = code.trim().toUpperCase();
  const existing = await EscalationRule.findOne({ code: normalizedCode });
  if (existing) {
    return res.status(409).json({
      success: false,
      message: `An Escalation rule with code '${normalizedCode}' already exists`,
    });
  }

  const rule = await EscalationRule.create({
    name: name.trim(),
    code: normalizedCode,
    escalationLevel: Number(escalationLevel),
    fromRole,
    toRole,
    fromDepartmentId: fromDepartmentId || null,
    toDepartmentId: toDepartmentId || null,
    hostelId: hostelId || null,
    priority: priority || null,
    nextAuthorityRole: nextAuthorityRole || toRole,
    nextAuthorityUserId: nextAuthorityUserId || null,
    escalationAfterHours: escalationAfterHours !== undefined ? Number(escalationAfterHours) : 0,
    resolutionHours: resolutionHours !== undefined ? Number(resolutionHours) : 24,
    isActive: isActive !== undefined ? Boolean(isActive) : true,
  });

  return res.status(201).json({
    success: true,
    message: 'Escalation Rule created successfully',
    data: rule,
  });
});

/**
 * PATCH /api/escalation-rules/:id
 */
export const updateEscalationRule = asyncHandler(async (req, res) => {
  const rule = await EscalationRule.findById(req.params.id);
  if (!rule) {
    return res.status(404).json({ success: false, message: 'Escalation Rule not found' });
  }

  const allowedFields = [
    'name',
    'escalationLevel',
    'fromRole',
    'toRole',
    'fromDepartmentId',
    'toDepartmentId',
    'hostelId',
    'priority',
    'nextAuthorityRole',
    'nextAuthorityUserId',
    'escalationAfterHours',
    'resolutionHours',
    'isActive',
  ];

  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      rule[field] = req.body[field];
    }
  }

  await rule.save();

  return res.status(200).json({
    success: true,
    message: 'Escalation Rule updated successfully',
    data: rule,
  });
});

/**
 * PATCH /api/escalation-rules/:id/status
 */
export const toggleEscalationRuleStatus = asyncHandler(async (req, res) => {
  const rule = await EscalationRule.findById(req.params.id);
  if (!rule) {
    return res.status(404).json({ success: false, message: 'Escalation Rule not found' });
  }

  rule.isActive = req.body.isActive !== undefined ? Boolean(req.body.isActive) : !rule.isActive;
  await rule.save();

  return res.status(200).json({
    success: true,
    message: `Escalation Rule ${rule.isActive ? 'activated' : 'deactivated'} successfully`,
    data: rule,
  });
});

// ==================== CONSOLIDATED SLA CONFIGURATION & ESCALATION CONTROL ====================

/**
 * GET /api/sla-rules/config
 * Returns high-level SLA & escalation settings for the Admin Console
 */
export const getSlaConfig = asyncHandler(async (req, res) => {
  const [escLvl1, escLvl2, escLvl3] = await Promise.all([
    EscalationRule.findOne({ escalationLevel: 1 }),
    EscalationRule.findOne({ escalationLevel: 2 }),
    EscalationRule.findOne({ escalationLevel: 3 }),
  ]);

  const slaRules = await SlaRule.find().sort({ priority: 1 }).lean();

  const priorityDurations = {
    CRITICAL: 4,
    HIGH: 24,
    MEDIUM: 48,
    LOW: 72,
  };
  let reminderThresholdPercent = 75;
  let escalationEnabled = true;

  slaRules.forEach((rule) => {
    if (priorityDurations[rule.priority] !== undefined && !rule.category && !rule.departmentId) {
      priorityDurations[rule.priority] = rule.resolutionHours;
    }
    if (rule.reminderThresholdPercent) {
      reminderThresholdPercent = rule.reminderThresholdPercent;
    }
    if (rule.escalationEnabled === false) {
      escalationEnabled = false;
    }
  });

  return res.status(200).json({
    success: true,
    data: {
      staffToWardenHours: escLvl1?.resolutionHours ?? 24,
      wardenToAuthorityHours: escLvl2?.resolutionHours ?? 24,
      authorityToAdminHours: escLvl3?.resolutionHours ?? 24,
      reminderThresholdPercent,
      escalationEnabled,
      priorityDurations,
      escalationRules: {
        level1: escLvl1,
        level2: escLvl2,
        level3: escLvl3,
      },
      totalSlaRules: slaRules.length,
    },
  });
});

/**
 * PUT /api/sla-rules/config
 * Updates high-level SLA & escalation settings in an authorized, audited manner
 */
export const updateSlaConfig = asyncHandler(async (req, res) => {
  const {
    staffToWardenHours,
    wardenToAuthorityHours,
    authorityToAdminHours,
    reminderThresholdPercent,
    escalationEnabled,
    priorityDurations,
  } = req.body;

  // 1. Update Escalation Level 1 (Staff -> Warden)
  if (staffToWardenHours !== undefined) {
    const hours = Number(staffToWardenHours);
    if (isNaN(hours) || hours <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Staff -> Warden SLA duration must be a positive number',
      });
    }
    const esc1 = await EscalationRule.findOne({ escalationLevel: 1 });
    if (esc1) {
      esc1.resolutionHours = hours;
      await esc1.save();
    } else {
      await EscalationRule.create({
        name: 'Level 1: Staff to Warden Escalation',
        code: 'ESC-LVL1',
        escalationLevel: 1,
        fromRole: 'HOSTEL_STAFF',
        toRole: 'WARDEN',
        nextAuthorityRole: 'WARDEN',
        resolutionHours: hours,
        isActive: true,
      });
    }
  }

  // 2. Update Escalation Level 2 (Warden -> Authority)
  if (wardenToAuthorityHours !== undefined) {
    const hours = Number(wardenToAuthorityHours);
    if (isNaN(hours) || hours <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Warden -> Authority SLA duration must be a positive number',
      });
    }
    const esc2 = await EscalationRule.findOne({ escalationLevel: 2 });
    if (esc2) {
      esc2.resolutionHours = hours;
      await esc2.save();
    } else {
      await EscalationRule.create({
        name: 'Level 2: Warden to Authority Escalation',
        code: 'ESC-LVL2',
        escalationLevel: 2,
        fromRole: 'WARDEN',
        toRole: 'AUTHORITY',
        nextAuthorityRole: 'AUTHORITY',
        resolutionHours: hours,
        isActive: true,
      });
    }
  }

  // 3. Update Escalation Level 3 (Authority -> Admin)
  if (authorityToAdminHours !== undefined) {
    const hours = Number(authorityToAdminHours);
    if (!isNaN(hours) && hours > 0) {
      const esc3 = await EscalationRule.findOne({ escalationLevel: 3 });
      if (esc3) {
        esc3.resolutionHours = hours;
        await esc3.save();
      } else {
        await EscalationRule.create({
          name: 'Level 3: Authority to Super Admin Escalation',
          code: 'ESC-LVL3',
          escalationLevel: 3,
          fromRole: 'AUTHORITY',
          toRole: 'SUPER_ADMIN',
          nextAuthorityRole: 'SUPER_ADMIN',
          resolutionHours: hours,
          isActive: true,
        });
      }
    }
  }

  // 4. Update Reminder Threshold %
  if (reminderThresholdPercent !== undefined) {
    const pct = Number(reminderThresholdPercent);
    if (isNaN(pct) || pct < 1 || pct > 99) {
      return res.status(400).json({
        success: false,
        message: 'Reminder threshold percent must be between 1% and 99%',
      });
    }
    await SlaRule.updateMany(
      {},
      { $set: { reminderThresholdPercent: pct, updatedBy: req.user._id } }
    );
  }

  // 5. Update Global Escalation Enabled
  if (escalationEnabled !== undefined) {
    const isEnabled = Boolean(escalationEnabled);
    await SlaRule.updateMany(
      {},
      { $set: { escalationEnabled: isEnabled, updatedBy: req.user._id } }
    );
    await EscalationRule.updateMany(
      {},
      { $set: { isActive: isEnabled } }
    );
  }

  // 6. Update Priority durations if provided
  if (priorityDurations && typeof priorityDurations === 'object') {
    for (const [priority, dur] of Object.entries(priorityDurations)) {
      const hours = Number(dur);
      if (!isNaN(hours) && hours > 0) {
        const existing = await SlaRule.findOne({ priority, category: null, departmentId: null });
        if (existing) {
          existing.resolutionHours = hours;
          existing.updatedBy = req.user._id;
          await existing.save();
        } else {
          await SlaRule.create({
            name: `${priority} Priority SLA`,
            code: `SLA-${priority}`,
            priority,
            description: `Default base SLA rule for ${priority} priority complaints`,
            resolutionHours: hours,
            reminderThresholdPercent: reminderThresholdPercent || 75,
            escalationEnabled: escalationEnabled !== undefined ? Boolean(escalationEnabled) : true,
            createdBy: req.user._id,
            updatedBy: req.user._id,
          });
        }
      }
    }
  }

  // Return updated config
  const [escLvl1, escLvl2, escLvl3] = await Promise.all([
    EscalationRule.findOne({ escalationLevel: 1 }),
    EscalationRule.findOne({ escalationLevel: 2 }),
    EscalationRule.findOne({ escalationLevel: 3 }),
  ]);

  const slaRules = await SlaRule.find().lean();
  const currentPriorityDurations = {
    CRITICAL: 4,
    HIGH: 24,
    MEDIUM: 48,
    LOW: 72,
  };
  let currentReminder = 75;
  let currentEscalationEnabled = true;

  slaRules.forEach((rule) => {
    if (currentPriorityDurations[rule.priority] !== undefined && !rule.category && !rule.departmentId) {
      currentPriorityDurations[rule.priority] = rule.resolutionHours;
    }
    if (rule.reminderThresholdPercent) currentReminder = rule.reminderThresholdPercent;
    if (rule.escalationEnabled === false) currentEscalationEnabled = false;
  });

  return res.status(200).json({
    success: true,
    message: 'Admin SLA configuration and escalation parameters updated successfully',
    data: {
      staffToWardenHours: escLvl1?.resolutionHours ?? 24,
      wardenToAuthorityHours: escLvl2?.resolutionHours ?? 24,
      authorityToAdminHours: escLvl3?.resolutionHours ?? 24,
      reminderThresholdPercent: currentReminder,
      escalationEnabled: currentEscalationEnabled,
      priorityDurations: currentPriorityDurations,
      escalationRules: {
        level1: escLvl1,
        level2: escLvl2,
        level3: escLvl3,
      },
    },
  });
});
