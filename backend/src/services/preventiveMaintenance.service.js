import mongoose from 'mongoose';
import MaintenancePlan from '../models/MaintenancePlan.js';
import MaintenanceCycle from '../models/MaintenanceCycle.js';
import MaintenanceWorkOrder from '../models/MaintenanceWorkOrder.js';
import Asset from '../models/Asset.js';
import User from '../models/User.js';
import Department from '../models/Department.js';
import Hostel from '../models/Hostel.js';
import { getNextSequence } from '../models/Counter.js';
import { ROLES } from '../constants/roles.js';
import {
  MAINTENANCE_TYPES,
  FREQUENCY_UNITS,
  MAINTENANCE_PLAN_STATUSES,
  CYCLE_STATUSES,
  ASSET_HEALTH_STATUSES,
  PREVENTIVE_THRESHOLDS,
} from '../constants/preventiveMaintenance.constants.js';
import {
  WORK_ORDER_STATUSES,
  WORK_ORDER_PRIORITIES,
  ASSET_STATUSES,
} from '../constants/workOrder.constants.js';
import { NOTIFICATION_TYPES } from '../constants/notification.constants.js';
import { createNotification } from './notification.service.js';
import { calculateNextDueDate } from '../utils/dateUtils.js';
import ApiError from '../utils/ApiError.js';

/**
 * Generate sequential atomic Maintenance Plan ID: MP-YYYY-XXXXX
 */
export const generatePlanId = async () => {
  const year = new Date().getFullYear();
  const sequenceKey = `maintenance_plan_${year}`;

  let attempts = 0;
  while (attempts < 5) {
    const seq = await getNextSequence(sequenceKey);
    const planId = `MP-${year}-${String(seq).padStart(5, '0')}`;

    const existing = await MaintenancePlan.findOne({ planId }).lean();
    if (!existing) {
      return planId;
    }
    attempts += 1;
  }

  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `MP-${year}-${randomSuffix}`;
};

/**
 * Generate sequential atomic Maintenance Cycle ID: CYC-YYYY-XXXXX
 */
export const generateCycleId = async () => {
  const year = new Date().getFullYear();
  const sequenceKey = `maintenance_cycle_${year}`;

  let attempts = 0;
  while (attempts < 5) {
    const seq = await getNextSequence(sequenceKey);
    const cycleId = `CYC-${year}-${String(seq).padStart(5, '0')}`;

    const existing = await MaintenanceCycle.findOne({ cycleId }).lean();
    if (!existing) {
      return cycleId;
    }
    attempts += 1;
  }

  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `CYC-${year}-${randomSuffix}`;
};

/**
 * Authorization guard for plan management
 */
const canManagePlans = (user) => {
  return [ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN].includes(user.role);
};

/**
 * Create a new Maintenance Plan
 */
export const createMaintenancePlan = async (data, user) => {
  if (!canManagePlans(user)) {
    throw new ApiError(403, 'Forbidden: Only Wardens, Authorities, and Admins can create maintenance plans.');
  }

  const {
    name,
    description,
    assetId,
    maintenanceType,
    frequency,
    frequencyUnit,
    priority,
    estimatedDuration,
    assignedDepartmentId,
    preferredAssigneeId,
    startDate,
  } = data;

  if (!name || name.trim().length < 3) {
    throw new ApiError(400, 'Plan name must be at least 3 characters.');
  }
  if (!assetId || !mongoose.isValidObjectId(assetId)) {
    throw new ApiError(400, 'A valid asset reference is required.');
  }
  if (!frequency || parseInt(frequency, 10) < 1) {
    throw new ApiError(400, 'Frequency must be a positive integer.');
  }

  const asset = await Asset.findById(assetId);
  if (!asset) {
    throw new ApiError(404, 'Referenced asset not found.');
  }

  // Warden scope: asset must belong to warden's hostel
  if (user.role === ROLES.WARDEN && user.hostelId) {
    const wardenHostelId = String(user.hostelId._id || user.hostelId);
    if (String(asset.hostelId) !== wardenHostelId) {
      throw new ApiError(403, 'Forbidden: You can only configure maintenance plans for assets in your assigned hostel.');
    }
  }

  const targetDeptId = assignedDepartmentId || asset.departmentId;
  const targetHostelId = asset.hostelId;

  // Validate preferred assignee if provided
  if (preferredAssigneeId) {
    if (!mongoose.isValidObjectId(preferredAssigneeId)) {
      throw new ApiError(400, 'Invalid preferred assignee ID.');
    }
    const staff = await User.findById(preferredAssigneeId);
    if (!staff || staff.role !== ROLES.HOSTEL_STAFF || !staff.isActive) {
      throw new ApiError(400, 'Preferred assignee must be an active hostel staff member.');
    }
  }

  const freqNum = parseInt(frequency, 10);
  const unit = frequencyUnit ? String(frequencyUnit).toUpperCase() : FREQUENCY_UNITS.MONTHS;

  const baseDate = startDate ? new Date(startDate) : new Date();
  if (isNaN(baseDate.getTime())) {
    throw new ApiError(400, 'Invalid startDate provided.');
  }

  // Compute next due date
  const nextDueAt = startDate ? new Date(startDate) : calculateNextDueDate(baseDate, freqNum, unit);

  const planId = await generatePlanId();

  const plan = await MaintenancePlan.create({
    planId,
    name: name.trim(),
    description: description?.trim() || '',
    assetId: asset._id,
    hostelId: targetHostelId,
    assignedDepartmentId: targetDeptId,
    preferredAssigneeId: preferredAssigneeId || null,
    maintenanceType: maintenanceType || MAINTENANCE_TYPES.PREVENTIVE,
    frequency: freqNum,
    frequencyUnit: unit,
    priority: priority || WORK_ORDER_PRIORITIES.MEDIUM,
    estimatedDuration: estimatedDuration || 2,
    status: MAINTENANCE_PLAN_STATUSES.ACTIVE,
    isActive: true,
    nextDueAt,
    lastCompletedAt: null,
    currentCycleNumber: 1,
    createdBy: user._id,
    auditLog: [
      {
        action: 'PLAN_CREATED',
        performedBy: user._id,
        previousStatus: null,
        newStatus: MAINTENANCE_PLAN_STATUSES.ACTIVE,
        note: `Maintenance plan created with frequency ${freqNum} ${unit}`,
        timestamp: new Date(),
      },
    ],
  });

  // Create initial scheduled cycle
  const cycleId = await generateCycleId();
  await MaintenanceCycle.create({
    cycleId,
    planId: plan._id,
    assetId: asset._id,
    cycleNumber: 1,
    scheduledDate: baseDate,
    dueDate: nextDueAt,
    assignedStaffId: preferredAssigneeId || null,
    status: CYCLE_STATUSES.SCHEDULED,
    isOverdue: false,
  });

  return plan;
};

/**
 * List Maintenance Plans with filters and pagination
 */
export const getMaintenancePlans = async (query = {}, user) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const filter = {};

  // Role scoping
  if (user.role === ROLES.WARDEN && user.hostelId) {
    filter.hostelId = user.hostelId._id || user.hostelId;
  } else if (user.role === ROLES.HOSTEL_STAFF && user.departmentId) {
    filter.assignedDepartmentId = user.departmentId._id || user.departmentId;
  }

  if (query.hostelId && mongoose.isValidObjectId(query.hostelId)) {
    filter.hostelId = query.hostelId;
  }
  if (query.departmentId && mongoose.isValidObjectId(query.departmentId)) {
    filter.assignedDepartmentId = query.departmentId;
  }
  if (query.assetId && mongoose.isValidObjectId(query.assetId)) {
    filter.assetId = query.assetId;
  }
  if (query.status) {
    filter.status = query.status.toUpperCase();
  }
  if (query.maintenanceType) {
    filter.maintenanceType = query.maintenanceType.toUpperCase();
  }
  if (query.priority) {
    filter.priority = query.priority.toUpperCase();
  }
  if (query.overdue === 'true') {
    filter.status = MAINTENANCE_PLAN_STATUSES.ACTIVE;
    filter.nextDueAt = { $lt: new Date() };
  }
  if (query.search) {
    const s = query.search.trim();
    filter.$or = [
      { planId: { $regex: s, $options: 'i' } },
      { name: { $regex: s, $options: 'i' } },
    ];
  }

  const [plans, total] = await Promise.all([
    MaintenancePlan.find(filter)
      .populate('assetId', 'assetId name assetType status condition')
      .populate('hostelId', 'name code')
      .populate('assignedDepartmentId', 'name code')
      .populate('preferredAssigneeId', 'name email role')
      .populate('lastWorkOrderId', 'workOrderId status priority')
      .sort({ nextDueAt: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    MaintenancePlan.countDocuments(filter),
  ]);

  return {
    plans,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

/**
 * Get single Maintenance Plan by ID with populated references
 */
export const getMaintenancePlanById = async (id, user) => {
  if (!mongoose.isValidObjectId(id)) {
    throw new ApiError(400, 'Invalid maintenance plan ID.');
  }

  const plan = await MaintenancePlan.findById(id)
    .populate('assetId')
    .populate('hostelId', 'name code')
    .populate('assignedDepartmentId', 'name code')
    .populate('preferredAssigneeId', 'name email role')
    .populate('createdBy', 'name email role')
    .populate('lastWorkOrderId', 'workOrderId status priority dueAt completedAt')
    .lean();

  if (!plan) {
    throw new ApiError(404, 'Maintenance plan not found.');
  }

  // Fetch cycles for this plan
  const cycles = await MaintenanceCycle.find({ planId: plan._id })
    .populate('workOrderId', 'workOrderId status priority dueAt completedAt')
    .populate('assignedStaffId', 'name email role')
    .sort({ cycleNumber: -1 })
    .lean();

  return {
    plan,
    cycles,
  };
};

/**
 * Update Maintenance Plan
 */
export const updateMaintenancePlan = async (id, data, user) => {
  if (!canManagePlans(user)) {
    throw new ApiError(403, 'Forbidden: Insufficient permissions to modify maintenance plans.');
  }
  if (!mongoose.isValidObjectId(id)) {
    throw new ApiError(400, 'Invalid maintenance plan ID.');
  }

  const plan = await MaintenancePlan.findById(id);
  if (!plan) {
    throw new ApiError(404, 'Maintenance plan not found.');
  }

  // Warden scope check
  if (user.role === ROLES.WARDEN && user.hostelId) {
    const wardenHostelId = String(user.hostelId._id || user.hostelId);
    if (String(plan.hostelId) !== wardenHostelId) {
      throw new ApiError(403, 'Forbidden: You cannot modify plans outside your hostel.');
    }
  }

  const allowedFields = [
    'name',
    'description',
    'maintenanceType',
    'frequency',
    'frequencyUnit',
    'priority',
    'estimatedDuration',
    'preferredAssigneeId',
    'assignedDepartmentId',
    'nextDueAt',
  ];

  const oldFreq = plan.frequency;
  const oldUnit = plan.frequencyUnit;

  allowedFields.forEach((field) => {
    if (data[field] !== undefined) {
      plan[field] = data[field];
    }
  });

  // If frequency changed and nextDueAt was not explicitly provided, update nextDueAt
  if ((data.frequency !== undefined || data.frequencyUnit !== undefined) && !data.nextDueAt) {
    const base = plan.lastCompletedAt || new Date();
    plan.nextDueAt = calculateNextDueDate(base, plan.frequency, plan.frequencyUnit);
  }

  plan.auditLog.push({
    action: 'PLAN_UPDATED',
    performedBy: user._id,
    previousStatus: plan.status,
    newStatus: plan.status,
    note: `Maintenance plan updated by ${user.name}`,
    timestamp: new Date(),
  });

  await plan.save();
  return plan;
};

/**
 * Pause Maintenance Plan
 */
export const pauseMaintenancePlan = async (id, { reason = '' } = {}, user) => {
  if (!canManagePlans(user)) {
    throw new ApiError(403, 'Forbidden: Insufficient permissions to pause maintenance plans.');
  }
  if (!mongoose.isValidObjectId(id)) {
    throw new ApiError(400, 'Invalid maintenance plan ID.');
  }

  const plan = await MaintenancePlan.findById(id);
  if (!plan) throw new ApiError(404, 'Maintenance plan not found.');

  const previousStatus = plan.status;
  plan.status = MAINTENANCE_PLAN_STATUSES.PAUSED;
  plan.isActive = false;

  plan.auditLog.push({
    action: 'PLAN_PAUSED',
    performedBy: user._id,
    previousStatus,
    newStatus: MAINTENANCE_PLAN_STATUSES.PAUSED,
    note: `Plan paused. ${reason ? `Reason: ${reason}` : ''}`,
    timestamp: new Date(),
  });

  await plan.save();
  return plan;
};

/**
 * Resume Maintenance Plan
 */
export const resumeMaintenancePlan = async (id, user) => {
  if (!canManagePlans(user)) {
    throw new ApiError(403, 'Forbidden: Insufficient permissions to resume maintenance plans.');
  }
  if (!mongoose.isValidObjectId(id)) {
    throw new ApiError(400, 'Invalid maintenance plan ID.');
  }

  const plan = await MaintenancePlan.findById(id);
  if (!plan) throw new ApiError(404, 'Maintenance plan not found.');

  const previousStatus = plan.status;
  plan.status = MAINTENANCE_PLAN_STATUSES.ACTIVE;
  plan.isActive = true;

  // If nextDueAt is in the past, adjust it to a fresh schedule starting from now
  const now = new Date();
  if (plan.nextDueAt < now) {
    plan.nextDueAt = calculateNextDueDate(now, plan.frequency, plan.frequencyUnit);
  }

  plan.auditLog.push({
    action: 'PLAN_RESUMED',
    performedBy: user._id,
    previousStatus,
    newStatus: MAINTENANCE_PLAN_STATUSES.ACTIVE,
    note: `Plan resumed by ${user.name}. Next due: ${plan.nextDueAt.toISOString()}`,
    timestamp: now,
  });

  await plan.save();
  return plan;
};

/**
 * Deactivate / Cancel Maintenance Plan
 */
export const deactivateMaintenancePlan = async (id, { reason = '' } = {}, user) => {
  if (!canManagePlans(user)) {
    throw new ApiError(403, 'Forbidden: Insufficient permissions to deactivate maintenance plans.');
  }
  if (!mongoose.isValidObjectId(id)) {
    throw new ApiError(400, 'Invalid maintenance plan ID.');
  }

  const plan = await MaintenancePlan.findById(id);
  if (!plan) throw new ApiError(404, 'Maintenance plan not found.');

  const previousStatus = plan.status;
  plan.status = MAINTENANCE_PLAN_STATUSES.CANCELLED;
  plan.isActive = false;

  plan.auditLog.push({
    action: 'PLAN_DEACTIVATED',
    performedBy: user._id,
    previousStatus,
    newStatus: MAINTENANCE_PLAN_STATUSES.CANCELLED,
    note: `Plan deactivated. ${reason ? `Reason: ${reason}` : ''}`,
    timestamp: new Date(),
  });

  await plan.save();
  return plan;
};

/**
 * Evaluate Asset Health Indicator using deterministic business rules (NO AI/ML)
 */
export const evaluateAssetHealth = (asset, workOrders = [], plans = []) => {
  if (!asset) return ASSET_HEALTH_STATUSES.HEALTHY;

  if (asset.status === ASSET_STATUSES.RETIRED) {
    return ASSET_HEALTH_STATUSES.RETIRED;
  }

  if (asset.status === ASSET_STATUSES.DAMAGED || asset.condition === 'CRITICAL') {
    return ASSET_HEALTH_STATUSES.CRITICAL;
  }

  // Check frequently failing threshold: >= 3 work orders in the last 90 days
  const now = Date.now();
  const windowMs = PREVENTIVE_THRESHOLDS.FREQUENT_FAILURE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const recentWorkOrders = workOrders.filter((w) => {
    const createdTime = new Date(w.createdAt).getTime();
    return now - createdTime <= windowMs;
  });

  if (recentWorkOrders.length >= PREVENTIVE_THRESHOLDS.FREQUENT_FAILURE_WORK_ORDER_COUNT) {
    return ASSET_HEALTH_STATUSES.FREQUENTLY_FAILING;
  }

  // Check overdue preventive plans
  const activePlans = plans.filter((p) => p.status === MAINTENANCE_PLAN_STATUSES.ACTIVE);
  const hasOverduePlan = activePlans.some((p) => p.nextDueAt && new Date(p.nextDueAt).getTime() < now);
  if (hasOverduePlan) {
    return ASSET_HEALTH_STATUSES.OVERDUE;
  }

  // Check maintenance due soon (within 24 hours)
  const dueWindowMs = 24 * 60 * 60 * 1000;
  const hasDuePlan = activePlans.some((p) => {
    if (!p.nextDueAt) return false;
    const dueTime = new Date(p.nextDueAt).getTime();
    return dueTime <= now + dueWindowMs;
  });
  if (hasDuePlan) {
    return ASSET_HEALTH_STATUSES.MAINTENANCE_DUE;
  }

  return ASSET_HEALTH_STATUSES.HEALTHY;
};

/**
 * Check if an asset is frequently failing
 */
export const isAssetFrequentlyFailing = (workOrders = []) => {
  const now = Date.now();
  const windowMs = PREVENTIVE_THRESHOLDS.FREQUENT_FAILURE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const recent = workOrders.filter((w) => {
    const createdTime = new Date(w.createdAt).getTime();
    return now - createdTime <= windowMs;
  });
  return recent.length >= PREVENTIVE_THRESHOLDS.FREQUENT_FAILURE_WORK_ORDER_COUNT;
};

/**
 * Central Scheduler Integration: Process Preventive Maintenance Jobs
 * Evaluates active plans, generates work orders idempotently, and triggers reminders.
 */
export const processPreventiveMaintenanceJobs = async (now = new Date()) => {
  const results = {
    workOrdersGenerated: 0,
    upcomingRemindersSent: 0,
    overdueMarked: 0,
    errors: [],
  };

  try {
    // 1. Due Maintenance: Generate Work Orders Idempotently
    const duePlans = await MaintenancePlan.find({
      status: MAINTENANCE_PLAN_STATUSES.ACTIVE,
      nextDueAt: { $lte: now },
    }).populate('assetId');

    for (const plan of duePlans) {
      try {
        // Check if an active work order already exists for this plan
        let activeWorkOrderExists = false;
        if (plan.lastWorkOrderId) {
          const currentWO = await MaintenanceWorkOrder.findById(plan.lastWorkOrderId).lean();
          if (
            currentWO &&
            [
              WORK_ORDER_STATUSES.CREATED,
              WORK_ORDER_STATUSES.ASSIGNED,
              WORK_ORDER_STATUSES.ACCEPTED,
              WORK_ORDER_STATUSES.IN_PROGRESS,
              WORK_ORDER_STATUSES.ON_HOLD,
            ].includes(currentWO.status)
          ) {
            activeWorkOrderExists = true;
          }
        }

        // Idempotency: Do NOT create duplicate work order if one is currently active
        if (!activeWorkOrderExists) {
          const asset = plan.assetId;
          const year = now.getFullYear();
          const seq = await getNextSequence(`work_order_${year}`);
          const workOrderId = `WO-${year}-${String(seq).padStart(5, '0')}`;

          const durationHours = plan.estimatedDuration || 2;
          const dueAt = new Date(now.getTime() + durationHours * 3600 * 1000);

          const woStatus = plan.preferredAssigneeId
            ? WORK_ORDER_STATUSES.ASSIGNED
            : WORK_ORDER_STATUSES.CREATED;

          const workOrder = await MaintenanceWorkOrder.create({
            workOrderId,
            complaintId: null, // Standalone preventive maintenance job
            assetId: plan.assetId?._id || plan.assetId,
            maintenancePlanId: plan._id,
            title: `[Preventive Maintenance] ${plan.name}`,
            description:
              plan.description ||
              `Scheduled ${plan.maintenanceType} maintenance for ${asset?.name || 'asset'} (${asset?.assetId || ''})`,
            category: asset?.category || null,
            hostelId: plan.hostelId,
            departmentId: plan.assignedDepartmentId,
            assignedTo: plan.preferredAssigneeId || null,
            createdBy: plan.createdBy,
            priority: plan.priority || WORK_ORDER_PRIORITIES.MEDIUM,
            status: woStatus,
            dueAt,
            auditLog: [
              {
                action: 'AUTOMATICALLY_GENERATED',
                performedBy: null,
                previousStatus: null,
                newStatus: woStatus,
                note: `Automatically generated by Smart Preventive Maintenance Scheduler for Plan ${plan.planId}`,
                timestamp: now,
              },
            ],
          });

          // Link cycle
          let cycle = await MaintenanceCycle.findOne({
            planId: plan._id,
            cycleNumber: plan.currentCycleNumber,
          });

          if (!cycle) {
            const cycleId = await generateCycleId();
            cycle = await MaintenanceCycle.create({
              cycleId,
              planId: plan._id,
              assetId: plan.assetId?._id || plan.assetId,
              cycleNumber: plan.currentCycleNumber,
              scheduledDate: now,
              dueDate: plan.nextDueAt,
              workOrderId: workOrder._id,
              assignedStaffId: plan.preferredAssigneeId || null,
              status: CYCLE_STATUSES.WORK_ORDER_CREATED,
              isOverdue: false,
            });
          } else {
            cycle.workOrderId = workOrder._id;
            cycle.status = CYCLE_STATUSES.WORK_ORDER_CREATED;
            if (plan.preferredAssigneeId) cycle.assignedStaffId = plan.preferredAssigneeId;
            await cycle.save();
          }

          plan.lastWorkOrderId = workOrder._id;
          await plan.save();

          results.workOrdersGenerated += 1;

          // Dispatch notification to assigned technician or department head
          if (plan.preferredAssigneeId) {
            createNotification({
              recipient: plan.preferredAssigneeId,
              type: NOTIFICATION_TYPES.MAINTENANCE_WORK_ORDER_GENERATED,
              title: 'Preventive Maintenance Work Order Assigned',
              message: `Preventive maintenance ticket ${workOrder.workOrderId} has been generated for ${plan.name}.`,
              relatedEntityType: 'WORK_ORDER',
              relatedEntityId: workOrder._id,
              metadata: { workOrderId: workOrder.workOrderId, planId: plan.planId },
            }).catch(() => {});
          }
        }
      } catch (err) {
        results.errors.push({ planId: plan.planId, error: err.message });
      }
    }

    // 2. Upcoming Reminders (Window: nextDueAt between now and now + 7 days)
    const upcomingThreshold = new Date(
      now.getTime() + PREVENTIVE_THRESHOLDS.UPCOMING_DAYS_THRESHOLD * 24 * 3600 * 1000
    );

    const upcomingPlans = await MaintenancePlan.find({
      status: MAINTENANCE_PLAN_STATUSES.ACTIVE,
      nextDueAt: { $gt: now, $lte: upcomingThreshold },
    });

    for (const plan of upcomingPlans) {
      if (plan.upcomingReminderSentForCycle !== plan.currentCycleNumber) {
        if (plan.preferredAssigneeId) {
          createNotification({
            recipient: plan.preferredAssigneeId,
            type: NOTIFICATION_TYPES.MAINTENANCE_UPCOMING,
            title: 'Upcoming Preventive Maintenance Scheduled',
            message: `Preventive maintenance for ${plan.name} is due on ${plan.nextDueAt.toLocaleDateString()}.`,
            relatedEntityType: 'MAINTENANCE_PLAN',
            relatedEntityId: plan._id,
            metadata: { planId: plan.planId, nextDueAt: plan.nextDueAt },
          }).catch(() => {});
        }
        plan.upcomingReminderSentForCycle = plan.currentCycleNumber;
        await plan.save();
        results.upcomingRemindersSent += 1;
      }
    }

    // 3. Overdue Maintenance Cycles
    const overduePlans = await MaintenancePlan.find({
      status: MAINTENANCE_PLAN_STATUSES.ACTIVE,
      nextDueAt: { $lt: now },
    });

    for (const plan of overduePlans) {
      await MaintenanceCycle.updateMany(
        {
          planId: plan._id,
          cycleNumber: plan.currentCycleNumber,
          status: { $in: [CYCLE_STATUSES.SCHEDULED, CYCLE_STATUSES.WORK_ORDER_CREATED, CYCLE_STATUSES.IN_PROGRESS] },
        },
        { $set: { isOverdue: true } }
      );

      if (plan.overdueReminderSentForCycle !== plan.currentCycleNumber) {
        if (plan.preferredAssigneeId) {
          createNotification({
            recipient: plan.preferredAssigneeId,
            type: NOTIFICATION_TYPES.MAINTENANCE_OVERDUE,
            title: 'Preventive Maintenance Overdue',
            message: `Maintenance for ${plan.name} is overdue since ${plan.nextDueAt.toLocaleDateString()}!`,
            relatedEntityType: 'MAINTENANCE_PLAN',
            relatedEntityId: plan._id,
            metadata: { planId: plan.planId, nextDueAt: plan.nextDueAt },
          }).catch(() => {});
        }
        plan.overdueReminderSentForCycle = plan.currentCycleNumber;
        await plan.save();
        results.overdueMarked += 1;
      }
    }
  } catch (err) {
    console.error('[preventiveMaintenance] Error in scheduler cycle:', err.message);
    results.errors.push({ error: err.message });
  }

  return results;
};

/**
 * Hook triggered when a Work Order is COMPLETED
 * Updates the linked MaintenancePlan, cycles, nextDueAt, and Asset health.
 */
export const onPreventiveWorkOrderCompleted = async (workOrder, user) => {
  if (!workOrder.maintenancePlanId) return null;

  const plan = await MaintenancePlan.findById(workOrder.maintenancePlanId);
  if (!plan) return null;

  const completedTime = workOrder.completedAt || new Date();

  // 1. Calculate next due date safely with month boundaries
  const nextDueAt = calculateNextDueDate(completedTime, plan.frequency, plan.frequencyUnit);

  const prevCycleNumber = plan.currentCycleNumber;
  const nextCycleNumber = prevCycleNumber + 1;

  // 2. Update current cycle record
  await MaintenanceCycle.findOneAndUpdate(
    { planId: plan._id, cycleNumber: prevCycleNumber },
    {
      $set: {
        status: CYCLE_STATUSES.COMPLETED,
        completedAt: completedTime,
        completionNotes: workOrder.completionNote || 'Completed',
        isOverdue: false,
      },
    }
  );

  // 3. Update plan
  plan.lastCompletedAt = completedTime;
  plan.nextDueAt = nextDueAt;
  plan.currentCycleNumber = nextCycleNumber;
  plan.upcomingReminderSentForCycle = 0;
  plan.overdueReminderSentForCycle = 0;

  plan.auditLog.push({
    action: 'CYCLE_COMPLETED',
    performedBy: user?._id || null,
    previousStatus: plan.status,
    newStatus: plan.status,
    note: `Maintenance cycle ${prevCycleNumber} completed via Work Order ${workOrder.workOrderId}. Next due date calculated: ${nextDueAt.toISOString()}`,
    timestamp: completedTime,
  });

  await plan.save();

  // 4. Provision next scheduled cycle
  const nextCycleId = await generateCycleId();
  await MaintenanceCycle.create({
    cycleId: nextCycleId,
    planId: plan._id,
    assetId: plan.assetId,
    cycleNumber: nextCycleNumber,
    scheduledDate: completedTime,
    dueDate: nextDueAt,
    assignedStaffId: plan.preferredAssigneeId || null,
    status: CYCLE_STATUSES.SCHEDULED,
    isOverdue: false,
  });

  // 5. Update Asset maintenance stats
  if (plan.assetId) {
    await Asset.findByIdAndUpdate(plan.assetId, {
      status: ASSET_STATUSES.ACTIVE,
      lastMaintenanceDate: completedTime,
    });
  }

  return plan;
};

/**
 * Preventive Maintenance Dashboard Metrics
 */
export const getPreventiveMaintenanceDashboard = async (user) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const upcomingThreshold = new Date(
    now.getTime() + PREVENTIVE_THRESHOLDS.UPCOMING_DAYS_THRESHOLD * 24 * 3600 * 1000
  );

  const filter = {};
  if (user.role === ROLES.WARDEN && user.hostelId) {
    filter.hostelId = user.hostelId._id || user.hostelId;
  } else if (user.role === ROLES.HOSTEL_STAFF && user.departmentId) {
    filter.assignedDepartmentId = user.departmentId._id || user.departmentId;
  }

  const [totalActivePlans, pausedPlans, allActive] = await Promise.all([
    MaintenancePlan.countDocuments({ ...filter, status: MAINTENANCE_PLAN_STATUSES.ACTIVE }),
    MaintenancePlan.countDocuments({ ...filter, status: MAINTENANCE_PLAN_STATUSES.PAUSED }),
    MaintenancePlan.find({ ...filter, status: MAINTENANCE_PLAN_STATUSES.ACTIVE }).lean(),
  ]);

  let upcomingCount = 0;
  let dueTodayCount = 0;
  let overdueCount = 0;

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  allActive.forEach((p) => {
    const dueTime = new Date(p.nextDueAt);
    if (dueTime < now) {
      overdueCount += 1;
    } else if (dueTime >= todayStart && dueTime <= todayEnd) {
      dueTodayCount += 1;
    } else if (dueTime > now && dueTime <= upcomingThreshold) {
      upcomingCount += 1;
    }
  });

  // Completed cycles this month
  const completedThisMonth = await MaintenanceCycle.countDocuments({
    status: CYCLE_STATUSES.COMPLETED,
    completedAt: { $gte: startOfMonth },
  });

  // Identify frequently failing assets
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 3600 * 1000);
  const assetWorkOrderCounts = await MaintenanceWorkOrder.aggregate([
    { $match: { assetId: { $ne: null }, createdAt: { $gte: ninetyDaysAgo } } },
    { $group: { _id: '$assetId', workOrderCount: { $sum: 1 } } },
    { $match: { workOrderCount: { $gte: PREVENTIVE_THRESHOLDS.FREQUENT_FAILURE_WORK_ORDER_COUNT } } },
  ]);

  const frequentlyFailingAssetIds = assetWorkOrderCounts.map((a) => a._id);
  const frequentlyFailingAssets = await Asset.find({ _id: { $in: frequentlyFailingAssetIds } })
    .populate('hostelId', 'name code')
    .populate('roomId', 'roomNumber')
    .populate('departmentId', 'name code')
    .lean();

  return {
    totalActivePlans,
    pausedPlans,
    upcomingCount,
    dueTodayCount,
    overdueCount,
    completedThisMonth,
    frequentlyFailingCount: frequentlyFailingAssets.length,
    frequentlyFailingAssets,
  };
};

/**
 * Get Upcoming Maintenance Queue
 */
export const getUpcomingMaintenance = async (query = {}, user) => {
  const now = new Date();
  const days = parseInt(query.days, 10) || PREVENTIVE_THRESHOLDS.UPCOMING_DAYS_THRESHOLD;
  const threshold = new Date(now.getTime() + days * 24 * 3600 * 1000);

  const filter = {
    status: MAINTENANCE_PLAN_STATUSES.ACTIVE,
    nextDueAt: { $gt: now, $lte: threshold },
  };

  if (user.role === ROLES.WARDEN && user.hostelId) {
    filter.hostelId = user.hostelId._id || user.hostelId;
  } else if (user.role === ROLES.HOSTEL_STAFF && user.departmentId) {
    filter.assignedDepartmentId = user.departmentId._id || user.departmentId;
  }

  const plans = await MaintenancePlan.find(filter)
    .populate('assetId', 'name assetId assetType condition')
    .populate('hostelId', 'name code')
    .populate('assignedDepartmentId', 'name code')
    .populate('preferredAssigneeId', 'name role')
    .sort({ nextDueAt: 1 })
    .lean();

  return plans;
};

/**
 * Get Due Maintenance Queue (Due <= now)
 */
export const getDueMaintenance = async (query = {}, user) => {
  const now = new Date();

  const filter = {
    status: MAINTENANCE_PLAN_STATUSES.ACTIVE,
    nextDueAt: { $lte: now },
  };

  if (user.role === ROLES.WARDEN && user.hostelId) {
    filter.hostelId = user.hostelId._id || user.hostelId;
  } else if (user.role === ROLES.HOSTEL_STAFF && user.departmentId) {
    filter.assignedDepartmentId = user.departmentId._id || user.departmentId;
  }

  const plans = await MaintenancePlan.find(filter)
    .populate('assetId', 'name assetId assetType condition')
    .populate('hostelId', 'name code')
    .populate('assignedDepartmentId', 'name code')
    .populate('preferredAssigneeId', 'name role')
    .populate('lastWorkOrderId', 'workOrderId status priority dueAt')
    .sort({ nextDueAt: 1 })
    .lean();

  return plans;
};

/**
 * Get Overdue Maintenance Queue (nextDueAt < now)
 */
export const getOverdueMaintenance = async (query = {}, user) => {
  const now = new Date();

  const filter = {
    status: MAINTENANCE_PLAN_STATUSES.ACTIVE,
    nextDueAt: { $lt: now },
  };

  if (user.role === ROLES.WARDEN && user.hostelId) {
    filter.hostelId = user.hostelId._id || user.hostelId;
  } else if (user.role === ROLES.HOSTEL_STAFF && user.departmentId) {
    filter.assignedDepartmentId = user.departmentId._id || user.departmentId;
  }

  const plans = await MaintenancePlan.find(filter)
    .populate('assetId', 'name assetId assetType condition')
    .populate('hostelId', 'name code')
    .populate('assignedDepartmentId', 'name code')
    .populate('preferredAssigneeId', 'name role')
    .populate('lastWorkOrderId', 'workOrderId status priority dueAt')
    .sort({ nextDueAt: 1 })
    .lean();

  return plans;
};
