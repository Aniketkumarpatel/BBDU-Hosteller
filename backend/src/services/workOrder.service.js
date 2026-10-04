import mongoose from 'mongoose';
import MaintenanceWorkOrder from '../models/MaintenanceWorkOrder.js';
import Complaint from '../models/Complaint.js';
import Asset from '../models/Asset.js';
import User from '../models/User.js';
import Department from '../models/Department.js';
import Hostel from '../models/Hostel.js';
import { getNextSequence } from '../models/Counter.js';
import { ROLES } from '../constants/roles.js';
import {
  WORK_ORDER_STATUSES,
  WORK_ORDER_PRIORITIES,
  ASSET_STATUSES,
} from '../constants/workOrder.constants.js';
import { SLA_STATUSES } from '../constants/sla.constants.js';
import { findApplicableSlaRule } from './sla.service.js';
import { createNotification } from './notification.service.js';
import { NOTIFICATION_TYPES } from '../constants/notification.constants.js';
import ApiError from '../utils/ApiError.js';

/**
 * Generate sequential atomic work order ID: WO-YYYY-XXXXX
 * e.g. WO-2026-00001
 */
export const generateWorkOrderId = async () => {
  const year = new Date().getFullYear();
  const sequenceKey = `work_order_${year}`;

  let attempts = 0;
  while (attempts < 5) {
    const seq = await getNextSequence(sequenceKey);
    const workOrderId = `WO-${year}-${String(seq).padStart(5, '0')}`;

    const existing = await MaintenanceWorkOrder.findOne({ workOrderId }).lean();
    if (!existing) {
      return workOrderId;
    }
    attempts += 1;
  }

  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `WO-${year}-${randomSuffix}`;
};

/**
 * Helper to verify user permissions for work order operations
 */
const canManageWorkOrders = (user) => {
  return [ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN, ROLES.HOSTEL_STAFF].includes(user.role);
};

const canAssignOrCancel = (user) => {
  return [ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN].includes(user.role);
};

/**
 * Create a new Maintenance Work Order
 */
export const createWorkOrder = async (data, user) => {
  if (!canManageWorkOrders(user)) {
    throw new ApiError(403, 'Forbidden: Students cannot create work orders.');
  }

  let {
    complaintId,
    assetId,
    title,
    description,
    priority,
    category,
    departmentId,
    hostelId,
    blockId,
    floorId,
    roomId,
    assignedTo,
    dueAt,
  } = data;

  // 1. If complaintId is supplied, inherit or validate details
  let linkedComplaint = null;
  if (complaintId) {
    linkedComplaint = await Complaint.findById(complaintId);
    if (!linkedComplaint) {
      throw new ApiError(404, 'Referenced complaint not found.');
    }
    // Inherit location and department if not specified
    hostelId = hostelId || linkedComplaint.hostelId;
    blockId = blockId || linkedComplaint.blockId;
    floorId = floorId || linkedComplaint.floorId;
    roomId = roomId || linkedComplaint.roomId;
    departmentId = departmentId || linkedComplaint.departmentId;
    category = category || linkedComplaint.category;
    priority = priority || linkedComplaint.priority;
    title = title || `Maintenance: ${linkedComplaint.title}`;
  }

  // 2. Validate mandatory fields
  if (!title || !description || !hostelId || !departmentId) {
    throw new ApiError(400, 'Title, description, hostel, and department are required for work order creation.');
  }

  // Validate hostel
  const hostel = await Hostel.findById(hostelId);
  if (!hostel) {
    throw new ApiError(404, 'Specified hostel not found.');
  }

  // Validate department
  const dept = await Department.findById(departmentId);
  if (!dept) {
    throw new ApiError(404, 'Specified department not found.');
  }

  // 3. Optional Asset Validation
  let linkedAsset = null;
  if (assetId) {
    linkedAsset = await Asset.findById(assetId);
    if (!linkedAsset) {
      throw new ApiError(404, 'Referenced asset not found.');
    }
  }

  // 4. Assigned staff validation if passed
  let assignedUser = null;
  if (assignedTo) {
    assignedUser = await User.findById(assignedTo);
    if (!assignedUser || assignedUser.role !== ROLES.HOSTEL_STAFF || !assignedUser.isActive) {
      throw new ApiError(400, 'Assigned user must be an active hostel staff member.');
    }
  }

  // 5. Calculate SLA due date if not custom specified
  let slaRule = null;
  let slaDueTime = dueAt ? new Date(dueAt) : null;
  if (!slaDueTime) {
    slaRule = await findApplicableSlaRule({
      priority: priority || WORK_ORDER_PRIORITIES.MEDIUM,
      category,
      departmentId,
    });
    const hours = slaRule?.resolutionHours || 48;
    slaDueTime = new Date(Date.now() + hours * 3600 * 1000);
  }

  const workOrderId = await generateWorkOrderId();
  const initialStatus = assignedUser ? WORK_ORDER_STATUSES.ASSIGNED : WORK_ORDER_STATUSES.CREATED;

  const workOrder = await MaintenanceWorkOrder.create({
    workOrderId,
    complaintId: linkedComplaint?._id || null,
    assetId: linkedAsset?._id || null,
    title: title.trim(),
    description: description.trim(),
    category: category || null,
    hostelId,
    blockId: blockId || null,
    floorId: floorId || null,
    roomId: roomId || null,
    departmentId,
    assignedTo: assignedUser?._id || null,
    createdBy: user._id,
    priority: priority || WORK_ORDER_PRIORITIES.MEDIUM,
    status: initialStatus,
    dueAt: slaDueTime,
    slaRuleId: slaRule?._id || null,
    slaStatus: assignedUser ? SLA_STATUSES.ACTIVE : null,
    slaStartedAt: assignedUser ? new Date() : null,
    slaDueAt: slaDueTime,
    auditLog: [
      {
        action: 'CREATED',
        performedBy: user._id,
        previousStatus: null,
        newStatus: initialStatus,
        note: assignedUser
          ? `Work order created and assigned to ${assignedUser.name}`
          : 'Work order created in queue',
        timestamp: new Date(),
      },
    ],
  });

  // Increment total work orders on asset if linked
  if (linkedAsset) {
    linkedAsset.totalWorkOrders = (linkedAsset.totalWorkOrders || 0) + 1;
    await linkedAsset.save();
  }

  // Dispatch notification to assigned staff
  if (assignedUser) {
    await createNotification({
      recipient: assignedUser._id,
      type: NOTIFICATION_TYPES.WORK_ORDER_ASSIGNED,
      title: 'New Work Order Assigned',
      message: `You have been assigned work order ${workOrderId}: "${workOrder.title}"`,
      relatedEntityType: 'WORK_ORDER',
      relatedEntityId: workOrder._id,
      metadata: { workOrderId, priority: workOrder.priority },
    }).catch(() => {});
  }

  return workOrder;
};

/**
 * List Work Orders with filters, search, and pagination
 */
export const getWorkOrders = async (query = {}, user) => {
  if (user.role === ROLES.STUDENT) {
    throw new ApiError(403, 'Forbidden: Students cannot access operational work orders.');
  }

  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const filter = {};

  // Role scoping
  if (user.role === ROLES.WARDEN) {
    if (user.hostelId) {
      filter.hostelId = user.hostelId._id || user.hostelId;
    }
  } else if (user.role === ROLES.HOSTEL_STAFF) {
    const staffId = new mongoose.Types.ObjectId(user._id);
    if (user.departmentId) {
      const deptId = new mongoose.Types.ObjectId(user.departmentId._id || user.departmentId);
      filter.$or = [{ assignedTo: staffId }, { departmentId: deptId }];
    } else {
      filter.assignedTo = staffId;
    }
  }

  // Filter params
  if (query.status) {
    filter.status = query.status.toUpperCase();
  }
  if (query.priority) {
    filter.priority = query.priority.toUpperCase();
  }
  if (query.departmentId && mongoose.isValidObjectId(query.departmentId)) {
    filter.departmentId = query.departmentId;
  }
  if (query.hostelId && mongoose.isValidObjectId(query.hostelId)) {
    filter.hostelId = query.hostelId;
  }
  if (query.assignedTo && mongoose.isValidObjectId(query.assignedTo)) {
    filter.assignedTo = query.assignedTo;
  }
  if (query.complaintId && mongoose.isValidObjectId(query.complaintId)) {
    filter.complaintId = query.complaintId;
  }
  if (query.assetId && mongoose.isValidObjectId(query.assetId)) {
    filter.assetId = query.assetId;
  }
  if (query.overdue === 'true') {
    filter.dueAt = { $lt: new Date() };
    filter.status = { $in: [WORK_ORDER_STATUSES.ASSIGNED, WORK_ORDER_STATUSES.ACCEPTED, WORK_ORDER_STATUSES.IN_PROGRESS, WORK_ORDER_STATUSES.ON_HOLD] };
  }
  if (query.search) {
    const s = query.search.trim();
    filter.$or = [
      { workOrderId: { $regex: s, $options: 'i' } },
      { title: { $regex: s, $options: 'i' } },
    ];
  }

  const [workOrders, total] = await Promise.all([
    MaintenanceWorkOrder.find(filter)
      .populate('complaintId', 'complaintId title status priority')
      .populate('assetId', 'assetId name status condition')
      .populate('hostelId', 'name code')
      .populate('departmentId', 'name code')
      .populate('assignedTo', 'name email role')
      .populate('createdBy', 'name role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    MaintenanceWorkOrder.countDocuments(filter),
  ]);

  return {
    workOrders,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

/**
 * Get aggregated Work Order metrics / stats
 */
export const getWorkOrderStats = async (query = {}, user) => {
  if (user.role === ROLES.STUDENT) {
    throw new ApiError(403, 'Forbidden: Students cannot access operational metrics.');
  }

  const filter = {};
  if (user.role === ROLES.WARDEN && user.hostelId) {
    filter.hostelId = new mongoose.Types.ObjectId(user.hostelId._id || user.hostelId);
  } else if (user.role === ROLES.HOSTEL_STAFF) {
    const staffId = new mongoose.Types.ObjectId(user._id);
    if (user.departmentId) {
      const deptId = new mongoose.Types.ObjectId(user.departmentId._id || user.departmentId);
      filter.$or = [{ assignedTo: staffId }, { departmentId: deptId }];
    } else {
      filter.assignedTo = staffId;
    }
  }

  if (query.hostelId && mongoose.isValidObjectId(query.hostelId)) {
    filter.hostelId = new mongoose.Types.ObjectId(query.hostelId);
  }
  if (query.departmentId && mongoose.isValidObjectId(query.departmentId)) {
    filter.departmentId = new mongoose.Types.ObjectId(query.departmentId);
  }

  const now = new Date();

  const [aggResult] = await MaintenanceWorkOrder.aggregate([
    { $match: filter },
    {
      $facet: {
        total: [{ $count: 'count' }],
        byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
        byPriority: [{ $group: { _id: '$priority', count: { $sum: 1 } } }],
        overdue: [
          {
            $match: {
              dueAt: { $lt: now, $ne: null },
              status: {
                $in: [
                  WORK_ORDER_STATUSES.ASSIGNED,
                  WORK_ORDER_STATUSES.ACCEPTED,
                  WORK_ORDER_STATUSES.IN_PROGRESS,
                  WORK_ORDER_STATUSES.ON_HOLD,
                ],
              },
            },
          },
          { $count: 'count' },
        ],
        completionTimes: [
          {
            $match: {
              status: WORK_ORDER_STATUSES.COMPLETED,
              completedAt: { $ne: null },
              createdAt: { $ne: null },
            },
          },
          {
            $project: {
              durationMs: { $subtract: ['$completedAt', '$createdAt'] },
            },
          },
          {
            $group: {
              _id: null,
              avgMs: { $avg: '$durationMs' },
            },
          },
        ],
      },
    },
  ]);

  const total = aggResult?.total[0]?.count || 0;
  const statusMap = (aggResult?.byStatus || []).reduce((acc, curr) => {
    acc[curr._id] = curr.count;
    return acc;
  }, {});

  const overdue = aggResult?.overdue[0]?.count || 0;
  const avgMs = aggResult?.completionTimes[0]?.avgMs || 0;
  const avgCompletionHours = Number((avgMs / (1000 * 3600)).toFixed(1));

  return {
    total,
    created: statusMap[WORK_ORDER_STATUSES.CREATED] || 0,
    assigned: statusMap[WORK_ORDER_STATUSES.ASSIGNED] || 0,
    accepted: statusMap[WORK_ORDER_STATUSES.ACCEPTED] || 0,
    inProgress: statusMap[WORK_ORDER_STATUSES.IN_PROGRESS] || 0,
    onHold: statusMap[WORK_ORDER_STATUSES.ON_HOLD] || 0,
    completed: statusMap[WORK_ORDER_STATUSES.COMPLETED] || 0,
    cancelled: statusMap[WORK_ORDER_STATUSES.CANCELLED] || 0,
    overdue,
    overdueRate: total > 0 ? Number(((overdue / total) * 100).toFixed(1)) : 0,
    avgCompletionHours,
  };
};

/**
 * Get single Work Order by ID with populated relations
 */
export const getWorkOrderById = async (idOrWorkOrderId, user) => {
  let query;
  if (idOrWorkOrderId.match(/^[0-9a-fA-F]{24}$/)) {
    query = { _id: idOrWorkOrderId };
  } else {
    query = { workOrderId: idOrWorkOrderId.toUpperCase() };
  }

  const workOrder = await MaintenanceWorkOrder.findOne(query)
    .populate('complaintId', 'complaintId title description status priority studentId')
    .populate('assetId', 'assetId name category assetType status condition')
    .populate('hostelId', 'name code type')
    .populate('blockId', 'name code')
    .populate('floorId', 'floorNumber name')
    .populate('roomId', 'roomNumber roomType')
    .populate('departmentId', 'name code type')
    .populate('assignedTo', 'name email role phone employeeId')
    .populate('createdBy', 'name email role')
    .populate('auditLog.performedBy', 'name role')
    .lean();

  if (!workOrder) {
    throw new ApiError(404, 'Work order not found.');
  }

  // Student RBAC verification: Student can only view work order if linked to their complaint
  if (user.role === ROLES.STUDENT) {
    if (!workOrder.complaintId || String(workOrder.complaintId.studentId) !== String(user._id)) {
      throw new ApiError(403, 'Forbidden: You do not have permission to view this work order.');
    }
  }

  return workOrder;
};

/**
 * Update Work Order fields (Title, Description, Priority, Asset)
 */
export const updateWorkOrder = async (id, data, user) => {
  if (!canManageWorkOrders(user)) {
    throw new ApiError(403, 'Forbidden: Insufficient permissions.');
  }

  const workOrder = await MaintenanceWorkOrder.findById(id);
  if (!workOrder) {
    throw new ApiError(404, 'Work order not found.');
  }

  if (workOrder.status === WORK_ORDER_STATUSES.COMPLETED || workOrder.status === WORK_ORDER_STATUSES.CANCELLED) {
    throw new ApiError(400, `Cannot modify work order in ${workOrder.status} state.`);
  }

  if (data.title) workOrder.title = data.title.trim();
  if (data.description) workOrder.description = data.description.trim();
  if (data.priority) workOrder.priority = data.priority;
  if (data.assetId !== undefined) {
    if (data.assetId) {
      const asset = await Asset.findById(data.assetId);
      if (!asset) throw new ApiError(404, 'Asset not found.');
      workOrder.assetId = asset._id;
    } else {
      workOrder.assetId = null;
    }
  }

  workOrder.auditLog.push({
    action: 'UPDATED',
    performedBy: user._id,
    previousStatus: workOrder.status,
    newStatus: workOrder.status,
    note: 'Work order details updated',
    timestamp: new Date(),
  });

  await workOrder.save();
  return workOrder;
};

/**
 * Assign Work Order to staff member
 */
export const assignWorkOrder = async (id, { assignedTo }, user) => {
  if (!canAssignOrCancel(user)) {
    throw new ApiError(403, 'Forbidden: Only Wardens, Authorities, or Admins can assign work orders.');
  }

  const workOrder = await MaintenanceWorkOrder.findById(id);
  if (!workOrder) throw new ApiError(404, 'Work order not found.');

  if (workOrder.status === WORK_ORDER_STATUSES.COMPLETED || workOrder.status === WORK_ORDER_STATUSES.CANCELLED) {
    throw new ApiError(400, `Cannot assign work order in ${workOrder.status} state.`);
  }

  const staff = await User.findById(assignedTo);
  if (!staff || staff.role !== ROLES.HOSTEL_STAFF || !staff.isActive) {
    throw new ApiError(400, 'Assigned user must be an active hostel staff member.');
  }

  const previousStatus = workOrder.status;
  workOrder.assignedTo = staff._id;
  workOrder.status = WORK_ORDER_STATUSES.ASSIGNED;

  // Activate SLA if not already active
  if (!workOrder.slaStartedAt) {
    workOrder.slaStartedAt = new Date();
    workOrder.slaStatus = SLA_STATUSES.ACTIVE;
  }

  workOrder.auditLog.push({
    action: 'ASSIGNED',
    performedBy: user._id,
    previousStatus,
    newStatus: WORK_ORDER_STATUSES.ASSIGNED,
    note: `Assigned to ${staff.name} (${staff.email})`,
    timestamp: new Date(),
  });

  await workOrder.save();

  await createNotification({
    recipient: staff._id,
    type: NOTIFICATION_TYPES.WORK_ORDER_ASSIGNED,
    title: 'Work Order Assigned',
    message: `You have been assigned work order ${workOrder.workOrderId}: "${workOrder.title}"`,
    relatedEntityType: 'WORK_ORDER',
    relatedEntityId: workOrder._id,
    metadata: { workOrderId: workOrder.workOrderId },
  }).catch(() => {});

  return workOrder;
};

/**
 * Reassign Work Order to another staff member with mandatory reason
 */
export const reassignWorkOrder = async (id, { assignedTo, reason }, user) => {
  if (!canAssignOrCancel(user)) {
    throw new ApiError(403, 'Forbidden: Only Wardens, Authorities, or Admins can reassign work orders.');
  }

  if (!reason || reason.trim().length < 5) {
    throw new ApiError(400, 'A valid reason of at least 5 characters is required for reassignment.');
  }

  const workOrder = await MaintenanceWorkOrder.findById(id);
  if (!workOrder) throw new ApiError(404, 'Work order not found.');

  if (workOrder.status === WORK_ORDER_STATUSES.COMPLETED || workOrder.status === WORK_ORDER_STATUSES.CANCELLED) {
    throw new ApiError(400, `Cannot reassign work order in ${workOrder.status} state.`);
  }

  const newStaff = await User.findById(assignedTo);
  if (!newStaff || newStaff.role !== ROLES.HOSTEL_STAFF || !newStaff.isActive) {
    throw new ApiError(400, 'New assigned user must be an active hostel staff member.');
  }

  const previousAssigneeId = workOrder.assignedTo;
  const previousStatus = workOrder.status;

  workOrder.assignedTo = newStaff._id;
  workOrder.status = WORK_ORDER_STATUSES.ASSIGNED;

  workOrder.auditLog.push({
    action: 'REASSIGNED',
    performedBy: user._id,
    previousStatus,
    newStatus: WORK_ORDER_STATUSES.ASSIGNED,
    note: `Reassigned to ${newStaff.name}. Reason: ${reason.trim()}`,
    timestamp: new Date(),
  });

  await workOrder.save();

  // Notify new staff
  await createNotification({
    recipient: newStaff._id,
    type: NOTIFICATION_TYPES.WORK_ORDER_ASSIGNED,
    title: 'Work Order Reassigned',
    message: `You have been assigned work order ${workOrder.workOrderId}. Reason: ${reason.trim()}`,
    relatedEntityType: 'WORK_ORDER',
    relatedEntityId: workOrder._id,
    metadata: { workOrderId: workOrder.workOrderId },
  }).catch(() => {});

  return workOrder;
};

/**
 * Accept Work Order (Staff accepts the ticket)
 */
export const acceptWorkOrder = async (id, user) => {
  const workOrder = await MaintenanceWorkOrder.findById(id);
  if (!workOrder) throw new ApiError(404, 'Work order not found.');

  // Check authorization: must be assigned staff or warden/admin
  if (user.role === ROLES.HOSTEL_STAFF && String(workOrder.assignedTo) !== String(user._id)) {
    throw new ApiError(403, 'Forbidden: You can only accept work orders assigned to you.');
  }

  if (workOrder.status !== WORK_ORDER_STATUSES.ASSIGNED) {
    throw new ApiError(400, `Cannot accept work order from status "${workOrder.status}". Expected "ASSIGNED".`);
  }

  workOrder.status = WORK_ORDER_STATUSES.ACCEPTED;
  workOrder.auditLog.push({
    action: 'ACCEPTED',
    performedBy: user._id,
    previousStatus: WORK_ORDER_STATUSES.ASSIGNED,
    newStatus: WORK_ORDER_STATUSES.ACCEPTED,
    note: `Work order accepted by ${user.name}`,
    timestamp: new Date(),
  });

  await workOrder.save();
  return workOrder;
};

/**
 * Start Work Order
 */
export const startWorkOrder = async (id, user) => {
  const workOrder = await MaintenanceWorkOrder.findById(id);
  if (!workOrder) throw new ApiError(404, 'Work order not found.');

  if (user.role === ROLES.HOSTEL_STAFF && String(workOrder.assignedTo) !== String(user._id)) {
    throw new ApiError(403, 'Forbidden: You can only start work orders assigned to you.');
  }

  if (workOrder.status !== WORK_ORDER_STATUSES.ACCEPTED && workOrder.status !== WORK_ORDER_STATUSES.ASSIGNED) {
    throw new ApiError(400, `Cannot start work from status "${workOrder.status}". Expected "ASSIGNED" or "ACCEPTED".`);
  }

  const previousStatus = workOrder.status;
  workOrder.status = WORK_ORDER_STATUSES.IN_PROGRESS;
  workOrder.startedAt = workOrder.startedAt || new Date();

  workOrder.auditLog.push({
    action: 'STARTED',
    performedBy: user._id,
    previousStatus,
    newStatus: WORK_ORDER_STATUSES.IN_PROGRESS,
    note: `Work started by ${user.name}`,
    timestamp: new Date(),
  });

  await workOrder.save();

  // If asset is linked, set asset status to UNDER_MAINTENANCE
  if (workOrder.assetId) {
    await Asset.findByIdAndUpdate(workOrder.assetId, {
      status: ASSET_STATUSES.UNDER_MAINTENANCE,
    }).catch(() => {});
  }

  return workOrder;
};

/**
 * Put Work Order ON_HOLD with mandatory reason
 */
export const holdWorkOrder = async (id, { holdReason }, user) => {
  if (!holdReason || holdReason.trim().length < 5) {
    throw new ApiError(400, 'A valid hold reason of at least 5 characters is required.');
  }

  const workOrder = await MaintenanceWorkOrder.findById(id);
  if (!workOrder) throw new ApiError(404, 'Work order not found.');

  if (user.role === ROLES.HOSTEL_STAFF && String(workOrder.assignedTo) !== String(user._id)) {
    throw new ApiError(403, 'Forbidden: You can only modify work orders assigned to you.');
  }

  if (workOrder.status !== WORK_ORDER_STATUSES.IN_PROGRESS) {
    throw new ApiError(400, `Cannot put work on hold from status "${workOrder.status}". Expected "IN_PROGRESS".`);
  }

  workOrder.status = WORK_ORDER_STATUSES.ON_HOLD;
  workOrder.holdReason = holdReason.trim();

  workOrder.auditLog.push({
    action: 'ON_HOLD',
    performedBy: user._id,
    previousStatus: WORK_ORDER_STATUSES.IN_PROGRESS,
    newStatus: WORK_ORDER_STATUSES.ON_HOLD,
    note: `Work held: ${holdReason.trim()}`,
    timestamp: new Date(),
  });

  await workOrder.save();
  return workOrder;
};

/**
 * Resume Work Order from ON_HOLD
 */
export const resumeWorkOrder = async (id, user) => {
  const workOrder = await MaintenanceWorkOrder.findById(id);
  if (!workOrder) throw new ApiError(404, 'Work order not found.');

  if (user.role === ROLES.HOSTEL_STAFF && String(workOrder.assignedTo) !== String(user._id)) {
    throw new ApiError(403, 'Forbidden: You can only modify work orders assigned to you.');
  }

  if (workOrder.status !== WORK_ORDER_STATUSES.ON_HOLD) {
    throw new ApiError(400, `Cannot resume work from status "${workOrder.status}". Expected "ON_HOLD".`);
  }

  workOrder.status = WORK_ORDER_STATUSES.IN_PROGRESS;
  workOrder.auditLog.push({
    action: 'RESUMED',
    performedBy: user._id,
    previousStatus: WORK_ORDER_STATUSES.ON_HOLD,
    newStatus: WORK_ORDER_STATUSES.IN_PROGRESS,
    note: `Work resumed by ${user.name}`,
    timestamp: new Date(),
  });

  await workOrder.save();
  return workOrder;
};

/**
 * Complete Work Order with mandatory completionNote and optional repair costs
 */
export const completeWorkOrder = async (
  id,
  { completionNote, laborCost = 0, partsCost = 0, serviceCost = 0, otherCost = 0 } = {},
  user
) => {
  if (!completionNote || completionNote.trim().length < 5) {
    throw new ApiError(400, 'A valid completion note of at least 5 characters is required.');
  }

  // Validate numeric non-negative costs
  if (
    Number(laborCost) < 0 ||
    Number(partsCost) < 0 ||
    Number(serviceCost) < 0 ||
    Number(otherCost) < 0
  ) {
    throw new ApiError(400, 'Repair and maintenance costs cannot be negative.');
  }

  const numLabor = Math.max(0, Number(laborCost) || 0);
  const numParts = Math.max(0, Number(partsCost) || 0);
  const numService = Math.max(0, Number(serviceCost) || 0);
  const numOther = Math.max(0, Number(otherCost) || 0);
  const calculatedTotalCost = Number((numLabor + numParts + numService + numOther).toFixed(2));

  const workOrder = await MaintenanceWorkOrder.findById(id);
  if (!workOrder) throw new ApiError(404, 'Work order not found.');

  if (user.role === ROLES.HOSTEL_STAFF && String(workOrder.assignedTo) !== String(user._id)) {
    throw new ApiError(403, 'Forbidden: You can only complete work orders assigned to you.');
  }

  if (workOrder.status !== WORK_ORDER_STATUSES.IN_PROGRESS && workOrder.status !== WORK_ORDER_STATUSES.ACCEPTED) {
    throw new ApiError(400, `Cannot complete work order from status "${workOrder.status}". Expected "IN_PROGRESS" or "ACCEPTED".`);
  }

  const previousStatus = workOrder.status;
  const now = new Date();

  workOrder.status = WORK_ORDER_STATUSES.COMPLETED;
  workOrder.completedAt = now;
  workOrder.completionNote = completionNote.trim();
  workOrder.slaStatus = SLA_STATUSES.COMPLETED;

  // Record cost breakdown
  workOrder.laborCost = numLabor;
  workOrder.partsCost = numParts;
  workOrder.serviceCost = numService;
  workOrder.otherCost = numOther;
  workOrder.totalCost = calculatedTotalCost;

  workOrder.auditLog.push({
    action: 'COMPLETED',
    performedBy: user._id,
    previousStatus,
    newStatus: WORK_ORDER_STATUSES.COMPLETED,
    note: `Completed: ${completionNote.trim()}${
      calculatedTotalCost > 0 ? ` (Total repair cost: ₹${calculatedTotalCost})` : ''
    }`,
    timestamp: now,
  });

  await workOrder.save();

  // If asset is linked, update asset status, maintenance counts, failure count & cumulative cost
  if (workOrder.assetId) {
    await Asset.findByIdAndUpdate(workOrder.assetId, {
      status: ASSET_STATUSES.ACTIVE,
      lastMaintenanceDate: now,
      $inc: {
        completedMaintenanceCount: 1,
        failureCount: 1,
        totalMaintenanceCost: calculatedTotalCost,
      },
    }).catch(() => {});
  }

  // If preventive maintenance plan is linked, complete cycle and calculate next due date
  if (workOrder.maintenancePlanId) {
    const { onPreventiveWorkOrderCompleted } = await import('./preventiveMaintenance.service.js');
    await onPreventiveWorkOrderCompleted(workOrder, user).catch((e) =>
      console.error('[workOrderService] Error updating preventive plan completion:', e.message)
    );
  }

  // If complaint is linked, notify creator / warden
  if (workOrder.complaintId) {
    const complaint = await Complaint.findById(workOrder.complaintId);
    if (complaint && complaint.studentId) {
      await createNotification({
        recipient: complaint.studentId,
        type: NOTIFICATION_TYPES.COMPLAINT_STATUS_CHANGED,
        title: 'Maintenance Work Completed',
        message: `Maintenance work order ${workOrder.workOrderId} for your complaint "${complaint.title}" has been completed.`,
        relatedEntityType: 'COMPLAINT',
        relatedEntityId: complaint._id,
        metadata: { workOrderId: workOrder.workOrderId },
      }).catch(() => {});
    }
  }

  return workOrder;
};

/**
 * Cancel Work Order with mandatory cancellationReason
 */
export const cancelWorkOrder = async (id, { cancellationReason }, user) => {
  if (!canAssignOrCancel(user)) {
    throw new ApiError(403, 'Forbidden: Only Wardens, Authorities, or Admins can cancel work orders.');
  }

  if (!cancellationReason || cancellationReason.trim().length < 5) {
    throw new ApiError(400, 'A valid cancellation reason of at least 5 characters is required.');
  }

  const workOrder = await MaintenanceWorkOrder.findById(id);
  if (!workOrder) throw new ApiError(404, 'Work order not found.');

  if (workOrder.status === WORK_ORDER_STATUSES.COMPLETED) {
    throw new ApiError(400, 'Cannot cancel a completed work order.');
  }

  const previousStatus = workOrder.status;
  workOrder.status = WORK_ORDER_STATUSES.CANCELLED;
  workOrder.cancellationReason = cancellationReason.trim();
  workOrder.slaStatus = SLA_STATUSES.CANCELLED;

  workOrder.auditLog.push({
    action: 'CANCELLED',
    performedBy: user._id,
    previousStatus,
    newStatus: WORK_ORDER_STATUSES.CANCELLED,
    note: `Cancelled: ${cancellationReason.trim()}`,
    timestamp: new Date(),
  });

  await workOrder.save();

  // Reset asset status if it was under maintenance
  if (workOrder.assetId) {
    await Asset.findByIdAndUpdate(workOrder.assetId, {
      status: ASSET_STATUSES.ACTIVE,
    }).catch(() => {});
  }

  return workOrder;
};
