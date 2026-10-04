import {
  SlaRule,
  EscalationRule,
  Complaint,
  ComplaintAssignment,
  ComplaintEscalation,
  ComplaintSlaCycle,
  User,
  Room,
  Department,
  MaintenanceWorkOrder,
} from '../models/index.js';
import {
  SLA_STATUSES,
  ESCALATION_TRIGGERS,
  DEFAULT_SLA_DURATIONS_HOURS,
  DEFAULT_REMINDER_THRESHOLD_PERCENT,
} from '../constants/sla.constants.js';
import { COMPLAINT_STATUSES } from '../constants/complaint.constants.js';
import { WORK_ORDER_STATUSES } from '../constants/workOrder.constants.js';
import { ROLES } from '../constants/roles.js';
import { createNotification } from './notification.service.js';
import { NOTIFICATION_TYPES } from '../constants/notification.constants.js';

/**
 * Find the most specific active SLA Rule matching complaint attributes
 */
export const findApplicableSlaRule = async ({ priority, category, departmentId } = {}) => {
  // 1. Exact match: Priority + Category + Department
  if (category && departmentId) {
    const exact = await SlaRule.findOne({
      priority,
      category,
      departmentId,
      isActive: true,
    }).lean();
    if (exact) return exact;
  }

  // 2. Priority + Category (wildcard department)
  if (category) {
    const catMatch = await SlaRule.findOne({
      priority,
      category,
      departmentId: null,
      isActive: true,
    }).lean();
    if (catMatch) return catMatch;
  }

  // 3. Priority + Department (wildcard category)
  if (departmentId) {
    const deptMatch = await SlaRule.findOne({
      priority,
      category: null,
      departmentId,
      isActive: true,
    }).lean();
    if (deptMatch) return deptMatch;
  }

  // 4. Priority only
  const priorityMatch = await SlaRule.findOne({
    priority,
    category: null,
    departmentId: null,
    isActive: true,
  }).lean();
  if (priorityMatch) return priorityMatch;

  // 5. Any active rule for this priority
  const anyActive = await SlaRule.findOne({ priority, isActive: true }).lean();
  if (anyActive) return anyActive;

  // 6. Controlled fallback if no database rule configured
  const resHours = DEFAULT_SLA_DURATIONS_HOURS[priority] || 48;
  return {
    _id: null,
    name: `Default ${priority} SLA`,
    code: `DEFAULT-${priority}`,
    priority,
    resolutionHours: resHours,
    reminderThresholdPercent: DEFAULT_REMINDER_THRESHOLD_PERCENT,
    escalationEnabled: true,
    escalationAfterHours: 0,
    isActive: true,
  };
};

/**
 * Start or restart an SLA cycle for an operational complaint.
 * Authoritative: all timestamps are strictly generated on the server.
 */
export const startSlaForComplaint = async (complaint, options = {}) => {
  const rule =
    options.rule ||
    (await findApplicableSlaRule({
      priority: complaint.priority,
      category: complaint.category,
      departmentId: complaint.departmentId,
    }));

  const now = new Date();
  const resolutionHours = options.resolutionHours || rule.resolutionHours || 24;
  const reminderPercent =
    rule.reminderThresholdPercent || DEFAULT_REMINDER_THRESHOLD_PERCENT;

  const slaDueAt = new Date(now.getTime() + resolutionHours * 60 * 60 * 1000);
  const reminderDueAt = new Date(
    now.getTime() + (resolutionHours * (reminderPercent / 100)) * 60 * 60 * 1000
  );

  // Close any previously active cycles for this complaint
  await ComplaintSlaCycle.updateMany(
    { complaintId: complaint._id, status: SLA_STATUSES.ACTIVE },
    { $set: { status: SLA_STATUSES.CANCELLED, completedAt: now } }
  );

  const existingCyclesCount = await ComplaintSlaCycle.countDocuments({
    complaintId: complaint._id,
  });

  // Create new SLA Cycle snapshot
  const slaCycle = await ComplaintSlaCycle.create({
    complaintId: complaint._id,
    cycleNumber: existingCyclesCount + 1,
    escalationLevel: complaint.currentEscalationLevel || 0,
    slaRuleId: rule._id || null,
    slaRuleSnapshot: {
      name: rule.name,
      code: rule.code,
      priority: complaint.priority,
      resolutionHours,
      reminderThresholdPercent: reminderPercent,
    },
    startedAt: now,
    dueAt: slaDueAt,
    reminderDueAt,
    status: SLA_STATUSES.ACTIVE,
  });

  // Update Complaint document
  complaint.slaRuleId = rule._id || null;
  complaint.slaStatus = SLA_STATUSES.ACTIVE;
  complaint.slaStartedAt = now;
  complaint.slaDueAt = slaDueAt;
  complaint.slaBreachedAt = null;
  complaint.reminderSentAt = null;
  complaint.slaCompletedAt = null;
  await complaint.save();

  return { complaint, slaCycle, rule };
};

/**
 * Complete active SLA cycle (called upon RESOLUTION / CLOSURE)
 */
export const completeSlaForComplaint = async (complaint) => {
  const now = new Date();
  complaint.slaStatus = SLA_STATUSES.COMPLETED;
  complaint.slaCompletedAt = now;
  await complaint.save();

  await ComplaintSlaCycle.updateMany(
    { complaintId: complaint._id, status: { $in: [SLA_STATUSES.ACTIVE, SLA_STATUSES.BREACHED] } },
    { $set: { status: SLA_STATUSES.COMPLETED, completedAt: now } }
  );

  return complaint;
};

/**
 * Find the authorized target user for an escalation level
 */
export const findEscalationTarget = async (complaint, targetLevel) => {
  const currentAssignee = complaint.assignedTo
    ? await User.findById(complaint.assignedTo).lean()
    : null;
  const currentRole = currentAssignee?.role;

  // 1. Check if a rule is configured from current assignee's role
  let rule = null;
  if (currentRole) {
    rule = await EscalationRule.findOne({
      fromRole: currentRole,
      isActive: true,
    }).lean();
  }

  // 2. Fallback: Query by escalationLevel
  if (!rule) {
    rule = await EscalationRule.findOne({
      escalationLevel: targetLevel,
      isActive: true,
    }).lean();
  }

  const toRole = rule?.toRole || rule?.nextAuthorityRole;

  // If specific user was configured in rule and is active
  if (rule?.nextAuthorityUserId) {
    const configuredUser = await User.findById(rule.nextAuthorityUserId).lean();
    if (configuredUser && configuredUser.isActive) {
      return { rule, targetUser: configuredUser };
    }
  }

  // Role-based target discovery
  let targetUser = null;

  if (toRole === ROLES.WARDEN) {
    // Find active warden for this complaint's hostel
    targetUser = await User.findOne({
      role: ROLES.WARDEN,
      hostelId: complaint.hostelId,
      isActive: true,
    }).lean();

    if (!targetUser) {
      // Fallback to any active warden
      targetUser = await User.findOne({ role: ROLES.WARDEN, isActive: true }).lean();
    }
  } else if (toRole === ROLES.AUTHORITY) {
    targetUser = await User.findOne({ role: ROLES.AUTHORITY, isActive: true }).lean();
  } else if (toRole === ROLES.SUPER_ADMIN) {
    targetUser = await User.findOne({ role: ROLES.SUPER_ADMIN, isActive: true }).lean();
  } else if (!toRole) {
    // Default hierarchical fallback if no rule configured
    if (targetLevel === 1) {
      targetUser =
        (await User.findOne({ role: ROLES.WARDEN, hostelId: complaint.hostelId, isActive: true }).lean()) ||
        (await User.findOne({ role: ROLES.WARDEN, isActive: true }).lean());
    } else if (targetLevel === 2) {
      targetUser = await User.findOne({ role: ROLES.AUTHORITY, isActive: true }).lean();
    } else {
      targetUser = await User.findOne({ role: ROLES.SUPER_ADMIN, isActive: true }).lean();
    }
  }

  return { rule, targetUser };
};

/**
 * Escalate a complaint following an SLA breach.
 * Idempotent: safe to run; updates assignment, records escalation audit history,
 * and initiates a new SLA cycle for the escalated handler.
 */
export const escalateComplaint = async (complaint, customReason = null) => {
  // Validate operational status
  const nonEscalatableStatuses = [
    COMPLAINT_STATUSES.RESOLVED,
    COMPLAINT_STATUSES.STUDENT_VERIFICATION,
    COMPLAINT_STATUSES.CLOSED,
    COMPLAINT_STATUSES.REJECTED,
  ];

  if (nonEscalatableStatuses.includes(complaint.status)) {
    return {
      success: false,
      escalated: false,
      message: `Cannot escalate complaint in '${complaint.status}' status.`,
    };
  }

  const now = new Date();
  const targetLevelCandidate = (complaint.currentEscalationLevel || 0) + 1;

  // Find target authority
  const { rule, targetUser } = await findEscalationTarget(complaint, targetLevelCandidate);
  const nextLevel = rule?.escalationLevel || targetLevelCandidate;

  // Mark current cycle breached
  complaint.slaStatus = SLA_STATUSES.BREACHED;
  if (!complaint.slaBreachedAt) {
    complaint.slaBreachedAt = now;
  }

  // Update active SLA cycle to BREACHED
  await ComplaintSlaCycle.updateMany(
    { complaintId: complaint._id, status: SLA_STATUSES.ACTIVE },
    { $set: { status: SLA_STATUSES.BREACHED, breachedAt: now } }
  );

  // If no valid target configured/found
  if (!targetUser) {
    complaint.save();
    return {
      success: true,
      escalated: false,
      targetConfigured: false,
      message: `ESCALATION_TARGET_NOT_CONFIGURED: No active recipient found for level ${nextLevel}`,
    };
  }

  // Guard against self-escalation if target is already the assignee
  if (complaint.assignedTo && String(complaint.assignedTo) === String(targetUser._id)) {
    console.log(`[SLA] Duplicate escalation prevented for complaint ${complaint.complaintId}`);
    await complaint.save();
    return {
      success: true,
      escalated: false,
      message: 'Complaint is already assigned to the target authority.',
    };
  }

  const previousAssigneeId = complaint.assignedTo;
  const previousAssignee = previousAssigneeId
    ? await User.findById(previousAssigneeId).lean()
    : null;

  // 1. Deactivate previous active assignment
  const lastActiveAssignment = await ComplaintAssignment.findOne({
    complaintId: complaint._id,
    isCurrent: true,
  });

  await ComplaintAssignment.updateMany(
    { complaintId: complaint._id, isCurrent: true },
    { $set: { isCurrent: false, unassignedAt: now } }
  );

  // 2. Create new Assignment record
  const reasonText =
    customReason ||
    `SLA breached: complaint was not resolved within configured resolution time (${complaint.priority} priority). Escalated to ${targetUser.role} (Level ${nextLevel}).`;

  const newAssignment = await ComplaintAssignment.create({
    complaintId: complaint._id,
    assignedBy: targetUser._id, // System routed, signed under authority
    assignedTo: targetUser._id,
    departmentId: complaint.departmentId || null,
    previousAssignee: previousAssigneeId || null,
    assignmentType: 'AUTO_ROUTED',
    reason: reasonText,
    assignedAt: now,
    isCurrent: true,
  });

  // 3. Create dedicated ComplaintEscalation record
  const escalationRecord = await ComplaintEscalation.create({
    complaintId: complaint._id,
    fromUserId: previousAssigneeId || null,
    toUserId: targetUser._id,
    fromRole: previousAssignee?.role || ROLES.HOSTEL_STAFF,
    toRole: targetUser.role,
    previousAssignmentId: lastActiveAssignment?._id || null,
    newAssignmentId: newAssignment._id,
    escalationLevel: nextLevel,
    reason: reasonText,
    triggeredBy: ESCALATION_TRIGGERS.SYSTEM,
    triggeredAt: now,
    slaBreachedAt: complaint.slaBreachedAt,
  });

  // 4. Update complaint attributes
  complaint.assignedTo = targetUser._id;
  complaint.currentEscalationLevel = nextLevel;
  complaint.escalationCount = (complaint.escalationCount || 0) + 1;

  // 5. Start a new SLA cycle for the escalated authority
  const newResolutionHours = rule?.resolutionHours || DEFAULT_SLA_DURATIONS_HOURS[complaint.priority] || 24;
  const newDueAt = new Date(now.getTime() + newResolutionHours * 60 * 60 * 1000);
  const reminderPercent = rule?.reminderThresholdPercent || DEFAULT_REMINDER_THRESHOLD_PERCENT;
  const newReminderDueAt = new Date(
    now.getTime() + (newResolutionHours * (reminderPercent / 100)) * 60 * 60 * 1000
  );

  const existingCyclesCount = await ComplaintSlaCycle.countDocuments({
    complaintId: complaint._id,
  });

  await ComplaintSlaCycle.create({
    complaintId: complaint._id,
    cycleNumber: existingCyclesCount + 1,
    escalationLevel: nextLevel,
    slaRuleId: rule?._id || null,
    slaRuleSnapshot: {
      name: rule?.name || `Escalation Level ${nextLevel} SLA`,
      code: rule?.code || `ESC-LVL-${nextLevel}`,
      priority: complaint.priority,
      resolutionHours: newResolutionHours,
      reminderThresholdPercent: reminderPercent,
    },
    startedAt: now,
    dueAt: newDueAt,
    reminderDueAt: newReminderDueAt,
    status: SLA_STATUSES.ACTIVE,
  });

  complaint.slaStatus = SLA_STATUSES.ACTIVE;
  complaint.slaStartedAt = now;
  complaint.slaDueAt = newDueAt;
  complaint.reminderSentAt = null;
  await complaint.save();

  // Trigger escalation notifications
  Promise.resolve().then(async () => {
    try {
      // 1. Notify Target Authority
      await createNotification({
        recipient: targetUser._id,
        type: NOTIFICATION_TYPES.COMPLAINT_ESCALATED,
        title: `Complaint Escalated to You (Level ${nextLevel})`,
        message: `Complaint #${complaint.complaintId} (${complaint.priority} priority) has been escalated to you due to SLA breach.`,
        relatedEntityType: 'COMPLAINT',
        relatedEntityId: complaint._id,
        metadata: { complaintId: complaint.complaintId, escalationLevel: nextLevel },
      });

      // 2. Notify Previous Assignee (breach alert)
      if (previousAssigneeId && String(previousAssigneeId) !== String(targetUser._id)) {
        await createNotification({
          recipient: previousAssigneeId,
          type: NOTIFICATION_TYPES.COMPLAINT_SLA_BREACHED,
          title: 'SLA Breached & Escalated',
          message: `Complaint #${complaint.complaintId} breached SLA window and was escalated to ${targetUser.role}.`,
          relatedEntityType: 'COMPLAINT',
          relatedEntityId: complaint._id,
          metadata: { complaintId: complaint.complaintId, escalationLevel: nextLevel },
        });
      }

      // 3. Notify Student
      if (complaint.studentId) {
        await createNotification({
          recipient: complaint.studentId,
          type: NOTIFICATION_TYPES.COMPLAINT_ESCALATED,
          title: 'Complaint Escalated to Higher Authority',
          message: `Your complaint #${complaint.complaintId} was automatically escalated to ${targetUser.role} to expedite resolution.`,
          relatedEntityType: 'COMPLAINT',
          relatedEntityId: complaint._id,
          metadata: { complaintId: complaint.complaintId, escalationLevel: nextLevel },
        });
      }
    } catch (e) {
      console.error('[slaService] Error dispatching escalation notifications:', e.message);
    }
  });

  return {
    success: true,
    escalated: true,
    targetConfigured: true,
    escalationRecord,
    newAssignment,
    complaint,
  };
};

/**
 * SLA Monitor & Auto-Escalation Engine
 * Idempotent batch worker intended to run periodically (e.g. every minute).
 */
export const processSlaAndEscalations = async () => {
  const now = new Date();
  const results = {
    processedCount: 0,
    remindersRecorded: 0,
    escalationsTriggered: 0,
    breachesRecorded: 0,
    errors: [],
  };

  // Find all complaints with an ACTIVE SLA and still in an operational state
  const activeComplaints = await Complaint.find({
    slaStatus: SLA_STATUSES.ACTIVE,
    status: {
      $nin: [
        COMPLAINT_STATUSES.RESOLVED,
        COMPLAINT_STATUSES.STUDENT_VERIFICATION,
        COMPLAINT_STATUSES.CLOSED,
        COMPLAINT_STATUSES.REJECTED,
      ],
    },
  });

  results.processedCount = activeComplaints.length;

  for (const complaint of activeComplaints) {
    try {
      // 1. Check Reminder Threshold
      if (!complaint.reminderSentAt && complaint.slaDueAt && complaint.slaStartedAt) {
        // Query active cycle reminderDueAt or calculate based on 75%
        const activeCycle = await ComplaintSlaCycle.findOne({
          complaintId: complaint._id,
          status: SLA_STATUSES.ACTIVE,
        });

        const reminderDueAt =
          activeCycle?.reminderDueAt ||
          new Date(
            complaint.slaStartedAt.getTime() +
              (complaint.slaDueAt.getTime() - complaint.slaStartedAt.getTime()) * 0.75
          );

        if (now >= reminderDueAt) {
          complaint.reminderSentAt = now;
          await complaint.save();

          if (activeCycle) {
            activeCycle.reminderSentAt = now;
            await activeCycle.save();
          }
          results.remindersRecorded += 1;
          console.log(`[SLA] Warning generated for complaint ${complaint.complaintId}`);

          // Dispatch in-app warning notification to assignee
          if (complaint.assignedTo) {
            createNotification({
              recipient: complaint.assignedTo,
              type: NOTIFICATION_TYPES.COMPLAINT_SLA_WARNING,
              title: 'SLA Reminder: Resolution Deadline Approaching',
              message: `Complaint #${complaint.complaintId} has reached the reminder threshold. Please take action before the SLA window expires.`,
              relatedEntityType: 'COMPLAINT',
              relatedEntityId: complaint._id,
              metadata: { complaintId: complaint.complaintId, priority: complaint.priority },
            }).catch((e) =>
              console.error('[slaService] Error dispatching reminder warning:', e.message)
            );
          }
        }
      }

      // 2. Check SLA Deadline & Breach
      if (complaint.slaDueAt && now >= complaint.slaDueAt) {
        console.log(`[SLA] Complaint ${complaint.complaintId} breached`);
        // Find if escalation is enabled in SLA rule
        let escalationEnabled = true;
        if (complaint.slaRuleId) {
          const rule = await SlaRule.findById(complaint.slaRuleId).lean();
          if (rule && rule.escalationEnabled === false) {
            escalationEnabled = false;
          }
        }

        if (escalationEnabled) {
          const escRes = await escalateComplaint(complaint);
          if (escRes.escalated) {
            results.escalationsTriggered += 1;
          } else {
            results.breachesRecorded += 1;
          }
        } else {
          complaint.slaStatus = SLA_STATUSES.BREACHED;
          if (!complaint.slaBreachedAt) complaint.slaBreachedAt = now;
          await complaint.save();
          results.breachesRecorded += 1;
        }
      }
    } catch (err) {
      console.error(`[slaEngine] Error processing complaint ${complaint.complaintId}:`, err);
      results.errors.push({ complaintId: complaint.complaintId, error: err.message });
    }
  }

  // Work Order SLA Monitoring
  try {
    const overdueWorkOrders = await MaintenanceWorkOrder.find({
      slaStatus: SLA_STATUSES.ACTIVE,
      status: {
        $in: [
          WORK_ORDER_STATUSES.ASSIGNED,
          WORK_ORDER_STATUSES.ACCEPTED,
          WORK_ORDER_STATUSES.IN_PROGRESS,
          WORK_ORDER_STATUSES.ON_HOLD,
        ],
      },
      dueAt: { $lt: now, $ne: null },
    });

    for (const wo of overdueWorkOrders) {
      wo.slaStatus = SLA_STATUSES.BREACHED;
      wo.slaBreachedAt = now;
      wo.auditLog.push({
        action: 'SLA_BREACHED',
        performedBy: null,
        previousStatus: wo.status,
        newStatus: wo.status,
        note: `SLA Breached: resolution deadline passed (${wo.dueAt.toISOString()})`,
        timestamp: now,
      });
      await wo.save();

      if (wo.assignedTo) {
        await createNotification({
          recipient: wo.assignedTo,
          type: NOTIFICATION_TYPES.WORK_ORDER_SLA_BREACHED,
          title: 'Work Order SLA Breached',
          message: `Work Order ${wo.workOrderId} has breached its SLA deadline!`,
          relatedEntityType: 'WORK_ORDER',
          relatedEntityId: wo._id,
          metadata: { workOrderId: wo.workOrderId },
        }).catch(() => {});
      }
    }
  } catch (err) {
    console.error('[slaEngine] Error processing work order SLAs:', err.message);
  }

  // Preventive Maintenance Engine Integration (Step 9)
  try {
    const { processPreventiveMaintenanceJobs } = await import('./preventiveMaintenance.service.js');
    const pmResults = await processPreventiveMaintenanceJobs(now);
    results.preventiveMaintenance = pmResults;
  } catch (err) {
    console.error('[slaEngine] Error processing preventive maintenance:', err.message);
  }

  // Cleaning & Housekeeping Engine Integration (Step 11)
  try {
    const { processCleaningTasks } = await import('./cleaning.service.js');
    const clnResults = await processCleaningTasks(now);
    results.cleaningTasks = clnResults;
  } catch (err) {
    console.error('[slaEngine] Error processing cleaning tasks:', err.message);
  }

  // Visitor & Outpass Management Engine Integration (Step 12)
  try {
    const { processOverdueOutpasses } = await import('./outpass.service.js');
    const outpassResults = await processOverdueOutpasses(now);
    results.outpassMonitoring = outpassResults;
  } catch (err) {
    console.error('[slaEngine] Error processing overdue outpasses:', err.message);
  }

  // Hostel Asset Lifecycle & Inventory Engine Integration (Step 14)
  try {
    const { processAssetLifecycleJobs } = await import('./asset.service.js');
    const assetResults = await processAssetLifecycleJobs(now);
    results.assetLifecycle = assetResults;
  } catch (err) {
    console.error('[slaEngine] Error processing asset lifecycle jobs:', err.message);
  }

  // Hostel Finance & Budget Monitoring Engine Integration (Step 15)
  try {
    const { processFinanceLifecycleJobs } = await import('./finance.service.js');
    const financeResults = await processFinanceLifecycleJobs(now);
    results.financeLifecycle = financeResults;
  } catch (err) {
    console.error('[slaEngine] Error processing finance lifecycle jobs:', err.message);
  }

  // Student Services & Digital Communication Lifecycle Engine Integration (Step 16)
  try {
    const { processStudentServicesLifecycleJobs } = await import('./studentServices.service.js');
    const studentServicesResults = await processStudentServicesLifecycleJobs(now);
    results.studentServicesLifecycle = studentServicesResults;
  } catch (err) {
    console.error('[slaEngine] Error processing student services lifecycle jobs:', err.message);
  }

  return results;
};

/**
 * Get comprehensive SLA information and cycles for a complaint
 */
export const getComplaintSlaInfo = async (complaintId) => {
  const complaint = await Complaint.findById(complaintId)
    .populate('slaRuleId')
    .lean();

  if (!complaint) return null;

  const cycles = await ComplaintSlaCycle.find({ complaintId: complaint._id })
    .sort({ cycleNumber: 1 })
    .lean();

  const now = Date.now();
  let remainingMs = null;
  let isBreached = false;
  let breachedMs = null;

  if (complaint.slaDueAt && complaint.slaStatus === SLA_STATUSES.ACTIVE) {
    const dueTime = new Date(complaint.slaDueAt).getTime();
    remainingMs = Math.max(0, dueTime - now);
    isBreached = now >= dueTime;
    if (isBreached) {
      breachedMs = now - dueTime;
    }
  } else if (complaint.slaStatus === SLA_STATUSES.BREACHED) {
    isBreached = true;
    remainingMs = 0;
    if (complaint.slaBreachedAt) {
      breachedMs = now - new Date(complaint.slaBreachedAt).getTime();
    } else if (complaint.slaDueAt) {
      breachedMs = now - new Date(complaint.slaDueAt).getTime();
    }
  }

  // Format human-readable remaining string
  let slaRemaining = null;
  if (isBreached && breachedMs !== null) {
    const totalMinutes = Math.floor(breachedMs / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    slaRemaining = `BREACHED by ${hours > 0 ? `${hours}h ` : ''}${minutes}m`;
  } else if (remainingMs !== null) {
    const totalMinutes = Math.floor(remainingMs / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    slaRemaining = `${hours > 0 ? `${hours}h ` : ''}${minutes}m remaining`;
  }

  // Derive business status state
  let state = 'NOT_STARTED';
  const isResolvedOrClosed = [
    COMPLAINT_STATUSES.RESOLVED,
    COMPLAINT_STATUSES.STUDENT_VERIFICATION,
    COMPLAINT_STATUSES.CLOSED,
  ].includes(complaint.status);

  if (isResolvedOrClosed || complaint.slaStatus === SLA_STATUSES.COMPLETED) {
    state = 'COMPLETED';
  } else if (complaint.slaStatus === SLA_STATUSES.PAUSED) {
    state = 'PAUSED';
  } else if (complaint.slaStatus === SLA_STATUSES.CANCELLED) {
    state = 'CANCELLED';
  } else if (isBreached || complaint.slaStatus === SLA_STATUSES.BREACHED) {
    state = 'BREACHED';
  } else if (complaint.slaStatus === SLA_STATUSES.ACTIVE) {
    const isWarning =
      Boolean(complaint.reminderSentAt) ||
      (complaint.slaStartedAt &&
        complaint.slaDueAt &&
        remainingMs <=
          (new Date(complaint.slaDueAt).getTime() -
            new Date(complaint.slaStartedAt).getTime()) *
            0.25);
    state = isWarning ? 'WARNING' : 'RUNNING';
  }

  return {
    slaStatus: complaint.slaStatus,
    state,
    slaRule: complaint.slaRuleId,
    slaStartedAt: complaint.slaStartedAt,
    slaDueAt: complaint.slaDueAt,
    slaBreachedAt: complaint.slaBreachedAt,
    reminderSentAt: complaint.reminderSentAt,
    currentEscalationLevel: complaint.currentEscalationLevel,
    escalationCount: complaint.escalationCount,
    remainingMs,
    breachedMs,
    slaRemaining,
    isBreached,
    cycles,
  };
};

/**
 * Get chronological escalation history for a complaint
 */
export const getComplaintEscalationHistory = async (complaintId) => {
  return ComplaintEscalation.find({ complaintId })
    .sort({ triggeredAt: -1 })
    .populate('fromUserId', 'name email role employeeId')
    .populate('toUserId', 'name email role employeeId')
    .lean();
};

/**
 * Run a full live pipeline diagnostic verification pass for SLA & Automatic Escalation.
 * Self-contained: creates a test complaint, simulates reminder, simulates Level 1 & Level 2 breach,
 * validates audit trails, and safely cleans up all test records.
 */
export const runLivePipelineVerification = async () => {
  const startTime = Date.now();
  const checks = [];

  // 1. Check Rule Definitions
  const slaRulesCount = await SlaRule.countDocuments({ isActive: true });
  const escRulesCount = await EscalationRule.countDocuments({ isActive: true });
  if (slaRulesCount === 0 || escRulesCount === 0) {
    throw new Error('SLA or Escalation rules are not configured in database');
  }
  checks.push({
    name: 'SLA & Escalation Rule Catalog',
    status: 'PASSED',
    details: `${slaRulesCount} active SLA rules, ${escRulesCount} active Escalation rules found.`,
  });

  // 2. Identify Test Actors
  const student = await User.findOne({ role: ROLES.STUDENT, isActive: true });
  const warden = await User.findOne({ role: ROLES.WARDEN, isActive: true });
  const staff = await User.findOne({ role: ROLES.HOSTEL_STAFF, isActive: true });
  const authority = await User.findOne({ role: ROLES.AUTHORITY, isActive: true });

  if (!student || !warden || !staff || !authority) {
    throw new Error('Missing active test users for required roles (STUDENT, WARDEN, HOSTEL_STAFF, AUTHORITY)');
  }
  checks.push({
    name: 'Role-Based Test Actors',
    status: 'PASSED',
    details: `Identified Student (${student.name}), Staff (${staff.name}), Warden (${warden.name}), Authority (${authority.name}).`,
  });

  // 3. Resolve location hierarchy and department references
  let hostelId = student.hostelId || warden.hostelId;
  let blockId = student.blockId;
  let floorId = student.floorId;
  let roomId = student.roomId;

  if (!roomId || !floorId || !blockId || !hostelId) {
    const fallbackRoom = await Room.findOne(hostelId ? { hostelId } : {}).lean();
    if (fallbackRoom) {
      roomId = roomId || fallbackRoom._id;
      floorId = floorId || fallbackRoom.floorId;
      blockId = blockId || fallbackRoom.blockId;
      hostelId = hostelId || fallbackRoom.hostelId;
    }
  }

  const dept = staff.departmentId
    ? await Department.findById(staff.departmentId).lean()
    : await Department.findOne().lean();
  const departmentId = dept?._id || staff.departmentId || null;

  // Create simulated complaint
  const complaint = await Complaint.create({
    complaintId: `TEST-DIAG-${Date.now().toString().slice(-6)}`,
    title: 'Diagnostic Pipeline Test - Emergency Power Failure',
    description: 'Automated test complaint for Step 5.5 SLA verification suite.',
    studentId: student._id,
    hostelId,
    blockId,
    floorId,
    roomId,
    departmentId,
    category: 'ELECTRICAL',
    issueType: 'ELECTRICITY_FAILURE',
    priority: 'CRITICAL',
    status: COMPLAINT_STATUSES.SUBMITTED,
  });

  try {
    // 4. Operational Triage & SLA Activation
    complaint.status = COMPLAINT_STATUSES.ASSIGNED;
    complaint.assignedTo = staff._id;
    complaint.departmentId = departmentId;
    complaint.triagedBy = warden._id;
    complaint.triagedAt = new Date();
    await complaint.save();

    await ComplaintAssignment.create({
      complaintId: complaint._id,
      assignedBy: warden._id,
      assignedTo: staff._id,
      departmentId,
      assignmentType: 'MANUAL',
      reason: 'Assigned for live SLA pipeline verification test',
      assignedAt: new Date(),
      isCurrent: true,
    });

    await startSlaForComplaint(complaint);
    const assignedCheck = await Complaint.findById(complaint._id);
    if (assignedCheck.slaStatus !== SLA_STATUSES.ACTIVE || !assignedCheck.slaDueAt) {
      throw new Error('SLA failed to initialize upon assignment');
    }
    checks.push({
      name: 'SLA Initialization & Due Date Calculation',
      status: 'PASSED',
      details: `Active SLA started. Due at: ${new Date(assignedCheck.slaDueAt).toISOString()}`,
    });

    // 5. Test 75% Reminder Threshold
    const now = Date.now();
    const mockStartedAt = new Date(now - 3.5 * 3600 * 1000);
    const mockDueAt = new Date(now + 0.5 * 3600 * 1000);
    const mockReminderDueAt = new Date(mockStartedAt.getTime() + (mockDueAt.getTime() - mockStartedAt.getTime()) * 0.75);

    await Complaint.findByIdAndUpdate(complaint._id, {
      slaStartedAt: mockStartedAt,
      slaDueAt: mockDueAt,
      reminderSentAt: null,
    });
    await ComplaintSlaCycle.findOneAndUpdate(
      { complaintId: complaint._id, status: SLA_STATUSES.ACTIVE },
      { startedAt: mockStartedAt, dueAt: mockDueAt, reminderDueAt: mockReminderDueAt, reminderSentAt: null }
    );

    const schedulerPass1 = await processSlaAndEscalations();
    const reminderCheck = await Complaint.findById(complaint._id);
    if (!reminderCheck.reminderSentAt) {
      throw new Error('Advance reminder was not recorded by SLA scheduler');
    }
    checks.push({
      name: 'Deadline Advance Reminder Threshold',
      status: 'PASSED',
      details: `Reminder flag triggered at 75% threshold (${schedulerPass1.remindersRecorded} reminder(s) recorded in cycle).`,
    });

    // 6. Test Level 1 Breach & Escalation (Staff -> Warden)
    await Complaint.findByIdAndUpdate(complaint._id, {
      slaDueAt: new Date(now - 60 * 1000), // expired 1 min ago
    });

    const schedulerPass2 = await processSlaAndEscalations();
    const esc1Check = await Complaint.findById(complaint._id);
    if (esc1Check.currentEscalationLevel !== 1 || String(esc1Check.assignedTo) !== String(warden._id)) {
      throw new Error(`Level 1 escalation failed. Expected Warden (${warden._id}), found ${esc1Check.assignedTo}`);
    }
    checks.push({
      name: 'Level 1 Automated Escalation (Staff -> Warden)',
      status: 'PASSED',
      details: `Breach detected: ticket reassigned to Warden. New cycle started. (${schedulerPass2.escalationsTriggered} escalation(s)).`,
    });

    // 7. Test Level 2 Breach & Escalation (Warden -> Authority)
    await Complaint.findByIdAndUpdate(complaint._id, {
      slaDueAt: new Date(now - 60 * 1000),
    });

    const schedulerPass3 = await processSlaAndEscalations();
    const esc2Check = await Complaint.findById(complaint._id);
    if (esc2Check.currentEscalationLevel !== 2 || String(esc2Check.assignedTo) !== String(authority._id)) {
      throw new Error(`Level 2 escalation failed. Expected Authority (${authority._id}), found ${esc2Check.assignedTo}`);
    }
    checks.push({
      name: 'Level 2 Automated Escalation (Warden -> Authority)',
      status: 'PASSED',
      details: `Subsequent breach: ticket escalated to Campus Authority (Level 2). (${schedulerPass3.escalationsTriggered} escalation(s)).`,
    });

    // 8. Validate Complete Audit Trails
    const cycles = await ComplaintSlaCycle.find({ complaintId: complaint._id });
    const escalations = await ComplaintEscalation.find({ complaintId: complaint._id });
    if (cycles.length < 3 || escalations.length < 2) {
      throw new Error(`Audit logs incomplete. Cycles: ${cycles.length}, Escalations: ${escalations.length}`);
    }
    checks.push({
      name: 'Audit Trail & Cycle Archiving',
      status: 'PASSED',
      details: `${cycles.length} SLA cycles preserved and ${escalations.length} chronological escalation logs recorded.`,
    });

    return {
      success: true,
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      totalChecks: checks.length,
      passedChecks: checks.filter((c) => c.status === 'PASSED').length,
      checks,
      summary: 'All SLA creation, reminder, countdown, and automatic escalation checks verified cleanly.',
    };
  } finally {
    // Clean up test records
    await Complaint.findByIdAndDelete(complaint._id);
    await ComplaintAssignment.deleteMany({ complaintId: complaint._id });
    await ComplaintEscalation.deleteMany({ complaintId: complaint._id });
    await ComplaintSlaCycle.deleteMany({ complaintId: complaint._id });
  }
};
