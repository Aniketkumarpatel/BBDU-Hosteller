import mongoose from 'mongoose';
import CleaningArea from '../models/CleaningArea.js';
import CleaningPlan from '../models/CleaningPlan.js';
import CleaningTask from '../models/CleaningTask.js';
import Complaint from '../models/Complaint.js';
import User from '../models/User.js';
import Department from '../models/Department.js';
import Hostel from '../models/Hostel.js';
import Counter, { getNextSequence } from '../models/Counter.js';
import {
  CLEANING_TASK_STATUSES,
  CLEANING_FREQUENCIES,
  DEFAULT_CHECKLISTS,
} from '../constants/cleaning.constants.js';
import { ROLES } from '../constants/roles.js';
import { NOTIFICATION_TYPES } from '../constants/notification.constants.js';
import { createNotification } from './notification.service.js';
import { calculateNextDueDate } from '../utils/dateUtils.js';
import ApiError from '../utils/ApiError.js';

/**
 * Generate atomic sequential Area ID: AREA-XXXXX
 */
export const generateCleaningAreaId = async (areaType = 'GEN') => {
  const prefix = String(areaType).substring(0, 4).toUpperCase();
  const sequenceKey = `cleaning_area_${prefix}`;
  const seq = await getNextSequence(sequenceKey);
  return `${prefix}-${String(seq).padStart(4, '0')}`;
};

/**
 * Generate atomic sequential Plan ID: CP-YYYY-XXXXX
 */
export const generateCleaningPlanId = async () => {
  const year = new Date().getFullYear();
  const sequenceKey = `cleaning_plan_${year}`;

  let attempts = 0;
  while (attempts < 5) {
    const seq = await getNextSequence(sequenceKey);
    const planId = `CP-${year}-${String(seq).padStart(5, '0')}`;
    const existing = await CleaningPlan.findOne({ planId }).lean();
    if (!existing) return planId;
    attempts += 1;
  }
  return `CP-${year}-${Math.floor(10000 + Math.random() * 90000)}`;
};

/**
 * Generate atomic sequential Task ID: CLN-YYYY-XXXXX
 */
export const generateCleaningTaskId = async () => {
  const year = new Date().getFullYear();
  const sequenceKey = `cleaning_task_${year}`;

  let attempts = 0;
  while (attempts < 5) {
    const seq = await getNextSequence(sequenceKey);
    const taskId = `CLN-${year}-${String(seq).padStart(5, '0')}`;
    const existing = await CleaningTask.findOne({ taskId }).lean();
    if (!existing) return taskId;
    attempts += 1;
  }
  return `CLN-${year}-${Math.floor(10000 + Math.random() * 90000)}`;
};

// ==========================================
// 1. CLEANING AREAS MANAGEMENT
// ==========================================

export const createCleaningArea = async (data, user) => {
  if (!data.name || !data.areaType || !data.hostelId) {
    throw new ApiError(400, 'Name, areaType, and hostelId are required');
  }

  const hostel = await Hostel.findById(data.hostelId);
  if (!hostel) throw new ApiError(404, 'Hostel not found');

  const areaId = data.areaId || (await generateCleaningAreaId(data.areaType));

  const checklist =
    data.customChecklist && data.customChecklist.length > 0
      ? data.customChecklist
      : DEFAULT_CHECKLISTS[data.areaType] || DEFAULT_CHECKLISTS.DEFAULT;

  const area = await CleaningArea.create({
    areaId,
    name: data.name,
    areaType: data.areaType,
    hostelId: data.hostelId,
    blockId: data.blockId || null,
    floorId: data.floorId || null,
    roomId: data.roomId || null,
    locationDescription: data.locationDescription || '',
    priority: data.priority || 'MEDIUM',
    customChecklist: checklist,
    notes: data.notes || '',
    isActive: data.isActive !== undefined ? data.isActive : true,
  });

  return area;
};

export const getCleaningAreas = async (query = {}) => {
  const filter = {};
  if (query.hostelId) filter.hostelId = query.hostelId;
  if (query.blockId) filter.blockId = query.blockId;
  if (query.floorId) filter.floorId = query.floorId;
  if (query.roomId) filter.roomId = query.roomId;
  if (query.areaType) filter.areaType = query.areaType;
  if (query.isActive !== undefined) filter.isActive = query.isActive === 'true' || query.isActive === true;
  if (query.search) {
    filter.$or = [
      { name: { $regex: query.search, $options: 'i' } },
      { areaId: { $regex: query.search, $options: 'i' } },
      { locationDescription: { $regex: query.search, $options: 'i' } },
    ];
  }

  return CleaningArea.find(filter)
    .populate('hostelId', 'name')
    .populate('blockId', 'name')
    .populate('floorId', 'floorNumber')
    .populate('roomId', 'roomNumber')
    .sort({ createdAt: -1 });
};

export const getCleaningAreaById = async (id) => {
  const area = await CleaningArea.findById(id)
    .populate('hostelId', 'name')
    .populate('blockId', 'name')
    .populate('floorId', 'floorNumber')
    .populate('roomId', 'roomNumber');
  if (!area) throw new ApiError(404, 'Cleaning area not found');
  return area;
};

export const updateCleaningArea = async (id, data) => {
  const area = await CleaningArea.findById(id);
  if (!area) throw new ApiError(404, 'Cleaning area not found');

  if (data.name) area.name = data.name;
  if (data.areaType) area.areaType = data.areaType;
  if (data.blockId !== undefined) area.blockId = data.blockId;
  if (data.floorId !== undefined) area.floorId = data.floorId;
  if (data.roomId !== undefined) area.roomId = data.roomId;
  if (data.locationDescription !== undefined) area.locationDescription = data.locationDescription;
  if (data.priority) area.priority = data.priority;
  if (data.customChecklist) area.customChecklist = data.customChecklist;
  if (data.notes !== undefined) area.notes = data.notes;
  if (data.isActive !== undefined) area.isActive = data.isActive;

  await area.save();
  return area;
};

// ==========================================
// 2. CLEANING PLANS MANAGEMENT
// ==========================================

export const createCleaningPlan = async (data, user) => {
  if (!data.name || !data.cleaningAreaId) {
    throw new ApiError(400, 'Plan name and cleaningAreaId are required');
  }

  const area = await CleaningArea.findById(data.cleaningAreaId);
  if (!area) throw new ApiError(404, 'Referenced cleaning area not found');

  const planId = await generateCleaningPlanId();

  // Establish initial checklist
  let checklist = [];
  if (data.checklist && data.checklist.length > 0) {
    checklist = data.checklist.map((c) => (typeof c === 'string' ? { item: c, isMandatory: true } : c));
  } else if (area.customChecklist && area.customChecklist.length > 0) {
    checklist = area.customChecklist.map((c) => ({ item: c, isMandatory: true }));
  } else {
    const defaults = DEFAULT_CHECKLISTS[area.areaType] || DEFAULT_CHECKLISTS.DEFAULT;
    checklist = defaults.map((c) => ({ item: c, isMandatory: true }));
  }

  const nextDueAt = data.nextDueAt ? new Date(data.nextDueAt) : new Date();

  // Find housekeeping department if departmentId not provided
  let departmentId = data.departmentId || null;
  if (!departmentId) {
    const housekeepingDept = await Department.findOne({ code: 'HOUSEKEEPING' }).lean();
    if (housekeepingDept) departmentId = housekeepingDept._id;
  }

  const plan = await CleaningPlan.create({
    planId,
    name: data.name,
    description: data.description || '',
    cleaningAreaId: area._id,
    cleaningType: data.cleaningType || 'ROUTINE',
    priority: data.priority || area.priority || 'MEDIUM',
    frequency: data.frequency || 'DAILY',
    frequencyInterval: data.frequencyInterval || 1,
    frequencyUnit: data.frequencyUnit || 'DAYS',
    preferredAssigneeId: data.preferredAssigneeId || null,
    departmentId,
    checklist,
    estimatedDurationMinutes: data.estimatedDurationMinutes || 30,
    startDate: data.startDate ? new Date(data.startDate) : new Date(),
    nextDueAt,
    isActive: data.isActive !== undefined ? data.isActive : true,
    createdBy: user._id,
  });

  return plan;
};

export const getCleaningPlans = async (query = {}) => {
  const filter = {};
  if (query.cleaningAreaId) filter.cleaningAreaId = query.cleaningAreaId;
  if (query.frequency) filter.frequency = query.frequency;
  if (query.isActive !== undefined) filter.isActive = query.isActive === 'true' || query.isActive === true;

  return CleaningPlan.find(filter)
    .populate({
      path: 'cleaningAreaId',
      populate: [{ path: 'hostelId', select: 'name' }, { path: 'roomId', select: 'roomNumber' }],
    })
    .populate('preferredAssigneeId', 'name email role')
    .populate('departmentId', 'name code')
    .populate('createdBy', 'name')
    .sort({ createdAt: -1 });
};

export const getCleaningPlanById = async (id) => {
  const plan = await CleaningPlan.findById(id)
    .populate({
      path: 'cleaningAreaId',
      populate: [{ path: 'hostelId', select: 'name' }, { path: 'roomId', select: 'roomNumber' }],
    })
    .populate('preferredAssigneeId', 'name email role')
    .populate('departmentId', 'name code')
    .populate('createdBy', 'name');
  if (!plan) throw new ApiError(404, 'Cleaning plan not found');
  return plan;
};

export const updateCleaningPlan = async (id, data) => {
  const plan = await CleaningPlan.findById(id);
  if (!plan) throw new ApiError(404, 'Cleaning plan not found');

  if (data.name) plan.name = data.name;
  if (data.description !== undefined) plan.description = data.description;
  if (data.cleaningType) plan.cleaningType = data.cleaningType;
  if (data.priority) plan.priority = data.priority;
  if (data.frequency) plan.frequency = data.frequency;
  if (data.frequencyInterval) plan.frequencyInterval = data.frequencyInterval;
  if (data.frequencyUnit) plan.frequencyUnit = data.frequencyUnit;
  if (data.preferredAssigneeId !== undefined) plan.preferredAssigneeId = data.preferredAssigneeId;
  if (data.checklist) plan.checklist = data.checklist;
  if (data.estimatedDurationMinutes) plan.estimatedDurationMinutes = data.estimatedDurationMinutes;
  if (data.nextDueAt) plan.nextDueAt = new Date(data.nextDueAt);
  if (data.isActive !== undefined) plan.isActive = data.isActive;

  await plan.save();
  return plan;
};

export const toggleCleaningPlanStatus = async (id, isActive) => {
  const plan = await CleaningPlan.findById(id);
  if (!plan) throw new ApiError(404, 'Cleaning plan not found');
  plan.isActive = isActive;
  await plan.save();
  return plan;
};

// ==========================================
// 3. CLEANING TASKS OPERATIONS & LIFECYCLE
// ==========================================

export const createManualTask = async (data, user) => {
  if (!data.cleaningAreaId) {
    throw new ApiError(400, 'cleaningAreaId is required');
  }

  const area = await CleaningArea.findById(data.cleaningAreaId).populate('hostelId');
  if (!area) throw new ApiError(404, 'Cleaning area not found');

  const taskId = await generateCleaningTaskId();
  const title = data.title || `${data.cleaningType || 'ROUTINE'} Cleaning: ${area.name}`;
  const scheduledDate = data.scheduledDate ? new Date(data.scheduledDate) : new Date();
  const dueAt = data.dueAt
    ? new Date(data.dueAt)
    : new Date(scheduledDate.getTime() + 4 * 60 * 60 * 1000); // 4 hours window default

  let taskChecklist = [];
  if (data.checklist && data.checklist.length > 0) {
    taskChecklist = data.checklist.map((item) =>
      typeof item === 'string' ? { item, isCompleted: false, note: '' } : item
    );
  } else if (area.customChecklist && area.customChecklist.length > 0) {
    taskChecklist = area.customChecklist.map((item) => ({
      item,
      isCompleted: false,
      note: '',
    }));
  } else {
    const defaults = DEFAULT_CHECKLISTS[area.areaType] || DEFAULT_CHECKLISTS.DEFAULT;
    taskChecklist = defaults.map((item) => ({ item, isCompleted: false, note: '' }));
  }

  const assignedTo = data.assignedTo || null;
  const status = assignedTo ? CLEANING_TASK_STATUSES.ASSIGNED : CLEANING_TASK_STATUSES.CREATED;

  const task = await CleaningTask.create({
    taskId,
    cleaningPlanId: data.cleaningPlanId || null,
    cleaningAreaId: area._id,
    title,
    cleaningType: data.cleaningType || 'ROUTINE',
    priority: data.priority || area.priority || 'MEDIUM',
    hostelId: area.hostelId._id || area.hostelId,
    blockId: area.blockId || null,
    floorId: area.floorId || null,
    roomId: area.roomId || null,
    assignedTo,
    assignedBy: assignedTo ? user._id : null,
    assignedAt: assignedTo ? new Date() : null,
    status,
    scheduledDate,
    dueAt,
    checklist: taskChecklist,
    complaintId: data.complaintId || null,
    auditLog: [
      {
        action: 'TASK_CREATED',
        performedBy: user._id,
        previousStatus: null,
        newStatus: status,
        note: `Task manually created by ${user.name || 'User'}`,
        timestamp: new Date(),
      },
    ],
  });

  if (assignedTo) {
    await createNotification({
      recipient: assignedTo,
      type: NOTIFICATION_TYPES.CLEANING_TASK_ASSIGNED,
      title: 'New Housekeeping Task Assigned',
      message: `You have been assigned cleaning task ${task.taskId}: ${task.title}`,
      relatedEntityType: 'CLEANING_TASK',
      relatedEntityId: task._id,
      metadata: { taskId: task.taskId, areaName: area.name },
    }).catch(() => {});
  }

  return task;
};

export const getCleaningTasks = async (query = {}, user) => {
  const filter = {};

  if (query.hostelId) filter.hostelId = query.hostelId;
  if (query.cleaningAreaId) filter.cleaningAreaId = query.cleaningAreaId;
  if (query.cleaningPlanId) filter.cleaningPlanId = query.cleaningPlanId;
  if (query.status) filter.status = query.status;
  if (query.cleaningType) filter.cleaningType = query.cleaningType;
  if (query.priority) filter.priority = query.priority;

  if (query.assignedTo) {
    filter.assignedTo = query.assignedTo;
  } else if (user && user.role === ROLES.HOSTEL_STAFF && !query.all) {
    // Staff see their own assigned tasks by default
    filter.assignedTo = user._id;
  }

  if (query.isOverdue !== undefined) {
    filter.isOverdue = query.isOverdue === 'true' || query.isOverdue === true;
  }
  if (query.isMissed !== undefined) {
    filter.isMissed = query.isMissed === 'true' || query.isMissed === true;
  }

  // Date filtering
  if (query.date) {
    const start = new Date(query.date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(query.date);
    end.setHours(23, 59, 59, 999);
    filter.scheduledDate = { $gte: start, $lte: end };
  } else if (query.startDate && query.endDate) {
    filter.scheduledDate = {
      $gte: new Date(query.startDate),
      $lte: new Date(query.endDate),
    };
  }

  if (query.search) {
    filter.$or = [
      { taskId: { $regex: query.search, $options: 'i' } },
      { title: { $regex: query.search, $options: 'i' } },
    ];
  }

  return CleaningTask.find(filter)
    .populate('cleaningAreaId', 'name areaType locationDescription')
    .populate('hostelId', 'name')
    .populate('blockId', 'name')
    .populate('floorId', 'floorNumber')
    .populate('roomId', 'roomNumber')
    .populate('assignedTo', 'name email employeeId role')
    .populate('assignedBy', 'name role')
    .populate('verifiedBy', 'name role')
    .sort({ dueAt: 1, createdAt: -1 });
};

export const getCleaningTaskById = async (id) => {
  const task = await CleaningTask.findById(id)
    .populate('cleaningAreaId')
    .populate('hostelId', 'name')
    .populate('blockId', 'name')
    .populate('floorId', 'floorNumber')
    .populate('roomId', 'roomNumber')
    .populate('assignedTo', 'name email employeeId role')
    .populate('assignedBy', 'name role')
    .populate('verifiedBy', 'name role')
    .populate('complaintId', 'complaintId title status priority')
    .populate('auditLog.performedBy', 'name role');

  if (!task) throw new ApiError(404, 'Cleaning task not found');
  return task;
};

export const assignTask = async (taskId, { assignedTo, note }, user) => {
  const task = await CleaningTask.findById(taskId);
  if (!task) throw new ApiError(404, 'Cleaning task not found');

  const assignee = await User.findById(assignedTo);
  if (!assignee) throw new ApiError(404, 'Assigned user not found');

  const previousStatus = task.status;
  task.assignedTo = assignee._id;
  task.assignedBy = user._id;
  task.assignedAt = new Date();
  task.status = CLEANING_TASK_STATUSES.ASSIGNED;

  task.auditLog.push({
    action: 'TASK_ASSIGNED',
    performedBy: user._id,
    previousStatus,
    newStatus: CLEANING_TASK_STATUSES.ASSIGNED,
    note: note || `Assigned to ${assignee.name} (${assignee.role})`,
    timestamp: new Date(),
  });

  await task.save();

  await createNotification({
    recipient: assignee._id,
    type: NOTIFICATION_TYPES.CLEANING_TASK_ASSIGNED,
    title: 'Cleaning Task Assigned',
    message: `You have been assigned task ${task.taskId}: ${task.title}`,
    relatedEntityType: 'CLEANING_TASK',
    relatedEntityId: task._id,
    metadata: { taskId: task.taskId },
  }).catch(() => {});

  return task;
};

export const acceptTask = async (taskId, user) => {
  const task = await CleaningTask.findById(taskId);
  if (!task) throw new ApiError(404, 'Cleaning task not found');

  if (task.assignedTo && String(task.assignedTo) !== String(user._id) && user.role === ROLES.HOSTEL_STAFF) {
    throw new ApiError(403, 'You are not assigned to this cleaning task');
  }

  const previousStatus = task.status;
  task.status = CLEANING_TASK_STATUSES.ACCEPTED;
  task.acceptedAt = new Date();

  task.auditLog.push({
    action: 'TASK_ACCEPTED',
    performedBy: user._id,
    previousStatus,
    newStatus: CLEANING_TASK_STATUSES.ACCEPTED,
    note: `Accepted by ${user.name}`,
    timestamp: new Date(),
  });

  await task.save();
  return task;
};

export const startTask = async (taskId, user) => {
  const task = await CleaningTask.findById(taskId);
  if (!task) throw new ApiError(404, 'Cleaning task not found');

  if (task.assignedTo && String(task.assignedTo) !== String(user._id) && user.role === ROLES.HOSTEL_STAFF) {
    throw new ApiError(403, 'You are not assigned to this cleaning task');
  }

  const previousStatus = task.status;
  task.status = CLEANING_TASK_STATUSES.IN_PROGRESS;
  task.startedAt = new Date();

  task.auditLog.push({
    action: 'TASK_STARTED',
    performedBy: user._id,
    previousStatus,
    newStatus: CLEANING_TASK_STATUSES.IN_PROGRESS,
    note: `Work started by ${user.name}`,
    timestamp: new Date(),
  });

  await task.save();
  return task;
};

export const holdTask = async (taskId, { reason }, user) => {
  const task = await CleaningTask.findById(taskId);
  if (!task) throw new ApiError(404, 'Cleaning task not found');

  const previousStatus = task.status;
  task.status = CLEANING_TASK_STATUSES.ON_HOLD;

  task.auditLog.push({
    action: 'TASK_PUT_ON_HOLD',
    performedBy: user._id,
    previousStatus,
    newStatus: CLEANING_TASK_STATUSES.ON_HOLD,
    note: reason || 'Task placed on hold',
    timestamp: new Date(),
  });

  await task.save();
  return task;
};

export const resumeTask = async (taskId, user) => {
  const task = await CleaningTask.findById(taskId);
  if (!task) throw new ApiError(404, 'Cleaning task not found');

  const previousStatus = task.status;
  task.status = CLEANING_TASK_STATUSES.IN_PROGRESS;

  task.auditLog.push({
    action: 'TASK_RESUMED',
    performedBy: user._id,
    previousStatus,
    newStatus: CLEANING_TASK_STATUSES.IN_PROGRESS,
    note: `Task resumed by ${user.name}`,
    timestamp: new Date(),
  });

  await task.save();
  return task;
};

export const completeTask = async (taskId, { checklist, completionNote }, user) => {
  const task = await CleaningTask.findById(taskId);
  if (!task) throw new ApiError(404, 'Cleaning task not found');

  if (task.assignedTo && String(task.assignedTo) !== String(user._id) && user.role === ROLES.HOSTEL_STAFF) {
    throw new ApiError(403, 'You are not assigned to complete this cleaning task');
  }

  // Update checklist items if supplied
  if (Array.isArray(checklist)) {
    task.checklist = checklist.map((item) => ({
      item: item.item,
      isCompleted: Boolean(item.isCompleted),
      note: item.note || '',
    }));
  }

  const previousStatus = task.status;
  task.status = CLEANING_TASK_STATUSES.COMPLETED;
  task.completedAt = new Date();
  task.completionNote = completionNote || '';

  task.auditLog.push({
    action: 'TASK_COMPLETED',
    performedBy: user._id,
    previousStatus,
    newStatus: CLEANING_TASK_STATUSES.COMPLETED,
    note: completionNote || `Completed by ${user.name}`,
    timestamp: new Date(),
  });

  await task.save();

  // If recurring plan, update plan lastCompletedAt
  if (task.cleaningPlanId) {
    await CleaningPlan.findByIdAndUpdate(task.cleaningPlanId, {
      lastCompletedAt: task.completedAt,
    }).catch(() => {});
  }

  // Notify wardens for supervisor inspection
  const wardens = await User.find({
    role: { $in: [ROLES.WARDEN, ROLES.SUPER_ADMIN] },
    hostelId: task.hostelId,
    isActive: true,
  });

  for (const warden of wardens) {
    createNotification({
      recipient: warden._id,
      type: NOTIFICATION_TYPES.CLEANING_TASK_COMPLETED,
      title: 'Cleaning Task Awaiting Inspection',
      message: `Task ${task.taskId} (${task.title}) has been completed and is ready for verification.`,
      relatedEntityType: 'CLEANING_TASK',
      relatedEntityId: task._id,
      metadata: { taskId: task.taskId, staffName: user.name },
    }).catch(() => {});
  }

  return task;
};

/**
 * Supervisor/Warden Verification of Cleaning Quality (Score 1-5)
 * Strict enforcement: Staff CANNOT self-verify!
 */
export const verifyTask = async (taskId, { qualityScore, verificationNote }, user) => {
  const task = await CleaningTask.findById(taskId);
  if (!task) throw new ApiError(404, 'Cleaning task not found');

  // Guard against self-verification
  if (task.assignedTo && String(task.assignedTo) === String(user._id)) {
    throw new ApiError(403, 'Housekeeping staff cannot self-verify their own cleaning tasks. A Warden or Supervisor must verify.');
  }

  // RBAC guard: must be WARDEN, AUTHORITY, or SUPER_ADMIN
  if (![ROLES.WARDEN, ROLES.AUTHORITY, ROLES.SUPER_ADMIN].includes(user.role)) {
    throw new ApiError(403, 'Only Wardens or Supervisors have authority to verify cleaning tasks');
  }

  const score = parseInt(qualityScore, 10);
  if (isNaN(score) || score < 1 || score > 5) {
    throw new ApiError(400, 'Quality score must be an integer between 1 and 5');
  }

  const previousStatus = task.status;
  task.status = CLEANING_TASK_STATUSES.VERIFIED;
  task.verifiedAt = new Date();
  task.verifiedBy = user._id;
  task.qualityScore = score;
  task.verificationNote = verificationNote || '';

  task.auditLog.push({
    action: 'TASK_VERIFIED',
    performedBy: user._id,
    previousStatus,
    newStatus: CLEANING_TASK_STATUSES.VERIFIED,
    note: `Verified with quality score ${score}/5. ${verificationNote || ''}`,
    timestamp: new Date(),
  });

  await task.save();

  // Notify assigned staff
  if (task.assignedTo) {
    createNotification({
      recipient: task.assignedTo,
      type: NOTIFICATION_TYPES.CLEANING_TASK_VERIFIED,
      title: 'Cleaning Task Verified',
      message: `Task ${task.taskId} was verified by ${user.name} with score ${score}/5.`,
      relatedEntityType: 'CLEANING_TASK',
      relatedEntityId: task._id,
      metadata: { taskId: task.taskId, qualityScore: score },
    }).catch(() => {});
  }

  return task;
};

/**
 * Supervisor rejects task back to IN_PROGRESS for rework
 */
export const rejectTask = async (taskId, { rejectionReason }, user) => {
  const task = await CleaningTask.findById(taskId);
  if (!task) throw new ApiError(404, 'Cleaning task not found');

  if (![ROLES.WARDEN, ROLES.AUTHORITY, ROLES.SUPER_ADMIN].includes(user.role)) {
    throw new ApiError(403, 'Only Wardens or Supervisors can reject cleaning tasks');
  }

  if (!rejectionReason) {
    throw new ApiError(400, 'Rejection reason is required');
  }

  const previousStatus = task.status;
  task.status = CLEANING_TASK_STATUSES.IN_PROGRESS;
  task.rejectionReason = rejectionReason;

  task.auditLog.push({
    action: 'TASK_REJECTED',
    performedBy: user._id,
    previousStatus,
    newStatus: CLEANING_TASK_STATUSES.IN_PROGRESS,
    note: `Rejected by ${user.name}: ${rejectionReason}`,
    timestamp: new Date(),
  });

  await task.save();

  if (task.assignedTo) {
    createNotification({
      recipient: task.assignedTo,
      type: NOTIFICATION_TYPES.CLEANING_TASK_REJECTED,
      title: 'Cleaning Task Rejected - Rework Required',
      message: `Task ${task.taskId} was rejected: ${rejectionReason}. Please redo the cleaning.`,
      relatedEntityType: 'CLEANING_TASK',
      relatedEntityId: task._id,
      metadata: { taskId: task.taskId, reason: rejectionReason },
    }).catch(() => {});
  }

  return task;
};

export const cancelTask = async (taskId, { reason }, user) => {
  const task = await CleaningTask.findById(taskId);
  if (!task) throw new ApiError(404, 'Cleaning task not found');

  const previousStatus = task.status;
  task.status = CLEANING_TASK_STATUSES.CANCELLED;

  task.auditLog.push({
    action: 'TASK_CANCELLED',
    performedBy: user._id,
    previousStatus,
    newStatus: CLEANING_TASK_STATUSES.CANCELLED,
    note: reason || 'Task cancelled',
    timestamp: new Date(),
  });

  await task.save();
  return task;
};

// ==========================================
// 4. CENTRAL SCHEDULER BATCH PROCESSOR
// ==========================================

/**
 * Idempotent batch worker called by central SLA scheduler loop.
 * 1. Generates recurring tasks for active plans due.
 * 2. Checks overdue and missed tasks.
 */
export const processCleaningTasks = async (referenceTime = new Date()) => {
  const now = new Date(referenceTime);
  const results = {
    plansProcessed: 0,
    tasksGenerated: 0,
    tasksMarkedOverdue: 0,
    tasksMarkedMissed: 0,
    errors: [],
  };

  try {
    // 1. Process active Cleaning Plans due for generation
    const duePlans = await CleaningPlan.find({
      isActive: true,
      nextDueAt: { $lte: now },
    }).populate('cleaningAreaId');

    results.plansProcessed = duePlans.length;

    for (const plan of duePlans) {
      try {
        if (!plan.cleaningAreaId || !plan.cleaningAreaId.isActive) {
          continue;
        }

        // Idempotency check: Don't duplicate task if one already generated for today
        const startOfDay = new Date(now);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(now);
        endOfDay.setHours(23, 59, 59, 999);

        const existingToday = await CleaningTask.findOne({
          cleaningPlanId: plan._id,
          scheduledDate: { $gte: startOfDay, $lte: endOfDay },
        }).lean();

        if (existingToday) {
          // Already created for this window, advance nextDueAt
          plan.nextDueAt = calculateNextDueDate(
            plan.nextDueAt,
            plan.frequencyInterval || 1,
            plan.frequencyUnit || 'DAYS'
          );
          await plan.save();
          continue;
        }

        // Generate task
        const area = plan.cleaningAreaId;
        const taskId = await generateCleaningTaskId();
        const dueAt = new Date(now.getTime() + (plan.estimatedDurationMinutes || 60) * 60 * 1000 * 2);

        const checklist = plan.checklist && plan.checklist.length > 0
          ? plan.checklist.map((c) => ({ item: c.item, isCompleted: false, note: '' }))
          : (DEFAULT_CHECKLISTS[area.areaType] || DEFAULT_CHECKLISTS.DEFAULT).map((item) => ({
              item,
              isCompleted: false,
              note: '',
            }));

        const status = plan.preferredAssigneeId
          ? CLEANING_TASK_STATUSES.ASSIGNED
          : CLEANING_TASK_STATUSES.CREATED;

        const task = await CleaningTask.create({
          taskId,
          cleaningPlanId: plan._id,
          cleaningAreaId: area._id,
          title: `${plan.cleaningType} Cleaning: ${area.name}`,
          cleaningType: plan.cleaningType,
          priority: plan.priority,
          hostelId: area.hostelId,
          blockId: area.blockId || null,
          floorId: area.floorId || null,
          roomId: area.roomId || null,
          assignedTo: plan.preferredAssigneeId || null,
          assignedAt: plan.preferredAssigneeId ? now : null,
          status,
          scheduledDate: now,
          dueAt,
          checklist,
          auditLog: [
            {
              action: 'AUTO_GENERATED',
              performedBy: null,
              previousStatus: null,
              newStatus: status,
              note: `Automatically scheduled from plan ${plan.planId}`,
              timestamp: now,
            },
          ],
        });

        results.tasksGenerated += 1;

        // Advance plan next due date
        plan.lastGeneratedAt = now;
        plan.nextDueAt = calculateNextDueDate(
          plan.nextDueAt,
          plan.frequencyInterval || 1,
          plan.frequencyUnit || 'DAYS'
        );
        await plan.save();

        if (plan.preferredAssigneeId) {
          createNotification({
            recipient: plan.preferredAssigneeId,
            type: NOTIFICATION_TYPES.CLEANING_TASK_ASSIGNED,
            title: 'Scheduled Cleaning Task Assigned',
            message: `Recurring task ${task.taskId} scheduled for ${area.name}`,
            relatedEntityType: 'CLEANING_TASK',
            relatedEntityId: task._id,
            metadata: { taskId: task.taskId, planId: plan.planId },
          }).catch(() => {});
        }
      } catch (planErr) {
        results.errors.push({ planId: plan.planId, error: planErr.message });
      }
    }

    // 2. Identify Overdue Tasks
    const overdueTasks = await CleaningTask.find({
      dueAt: { $lt: now },
      status: {
        $in: [
          CLEANING_TASK_STATUSES.CREATED,
          CLEANING_TASK_STATUSES.ASSIGNED,
          CLEANING_TASK_STATUSES.ACCEPTED,
          CLEANING_TASK_STATUSES.IN_PROGRESS,
          CLEANING_TASK_STATUSES.ON_HOLD,
        ],
      },
      isOverdue: false,
    });

    for (const task of overdueTasks) {
      task.isOverdue = true;
      task.auditLog.push({
        action: 'MARKED_OVERDUE',
        performedBy: null,
        previousStatus: task.status,
        newStatus: task.status,
        note: `Task passed due time (${task.dueAt.toISOString()})`,
        timestamp: now,
      });
      await task.save();
      results.tasksMarkedOverdue += 1;

      if (task.assignedTo) {
        createNotification({
          recipient: task.assignedTo,
          type: NOTIFICATION_TYPES.CLEANING_TASK_OVERDUE,
          title: 'Housekeeping Task Overdue',
          message: `Task ${task.taskId} (${task.title}) has exceeded its target completion window!`,
          relatedEntityType: 'CLEANING_TASK',
          relatedEntityId: task._id,
          metadata: { taskId: task.taskId },
        }).catch(() => {});
      }
    }

    // 3. Mark Missed Tasks (e.g. past scheduled date by more than 24 hours without work)
    const missedThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const missedTasks = await CleaningTask.find({
      dueAt: { $lt: missedThreshold },
      status: {
        $in: [CLEANING_TASK_STATUSES.CREATED, CLEANING_TASK_STATUSES.ASSIGNED],
      },
      isMissed: false,
    });

    for (const task of missedTasks) {
      task.isMissed = true;
      task.status = CLEANING_TASK_STATUSES.MISSED;
      task.auditLog.push({
        action: 'MARKED_MISSED',
        performedBy: null,
        previousStatus: task.status,
        newStatus: CLEANING_TASK_STATUSES.MISSED,
        note: 'Task marked missed after 24h grace window',
        timestamp: now,
      });
      await task.save();
      results.tasksMarkedMissed += 1;
    }
  } catch (err) {
    console.error('[cleaningService] Error in processCleaningTasks:', err.message);
    results.errors.push({ error: err.message });
  }

  return results;
};

// ==========================================
// 5. HOUSEKEEPING DASHBOARD & ANALYTICS
// ==========================================

export const getCleaningDashboardStats = async (filters = {}) => {
  const match = {};
  if (filters.hostelId) match.hostelId = new mongoose.Types.ObjectId(filters.hostelId);

  // Time boundaries for today
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const [
    totalAreas,
    activePlans,
    tasksTodayTotal,
    tasksTodayCompleted,
    tasksTodayVerified,
    tasksTodayInProgress,
    totalOverdue,
    totalMissed,
    qualityAgg,
    staffWorkload,
  ] = await Promise.all([
    CleaningArea.countDocuments({ ...match, isActive: true }),
    CleaningPlan.countDocuments({ isActive: true }),
    CleaningTask.countDocuments({
      ...match,
      scheduledDate: { $gte: todayStart, $lte: todayEnd },
    }),
    CleaningTask.countDocuments({
      ...match,
      scheduledDate: { $gte: todayStart, $lte: todayEnd },
      status: { $in: [CLEANING_TASK_STATUSES.COMPLETED, CLEANING_TASK_STATUSES.VERIFIED] },
    }),
    CleaningTask.countDocuments({
      ...match,
      scheduledDate: { $gte: todayStart, $lte: todayEnd },
      status: CLEANING_TASK_STATUSES.VERIFIED,
    }),
    CleaningTask.countDocuments({
      ...match,
      scheduledDate: { $gte: todayStart, $lte: todayEnd },
      status: CLEANING_TASK_STATUSES.IN_PROGRESS,
    }),
    CleaningTask.countDocuments({ ...match, isOverdue: true, status: { $nin: [CLEANING_TASK_STATUSES.COMPLETED, CLEANING_TASK_STATUSES.VERIFIED, CLEANING_TASK_STATUSES.CANCELLED] } }),
    CleaningTask.countDocuments({ ...match, isMissed: true }),
    // Quality score aggregation
    CleaningTask.aggregate([
      { $match: { ...match, qualityScore: { $ne: null } } },
      {
        $group: {
          _id: null,
          avgQualityScore: { $avg: '$qualityScore' },
          totalRated: { $sum: 1 },
        },
      },
    ]),
    // Staff workload aggregation
    CleaningTask.aggregate([
      {
        $match: {
          ...match,
          assignedTo: { $ne: null },
          scheduledDate: { $gte: todayStart, $lte: todayEnd },
        },
      },
      {
        $group: {
          _id: '$assignedTo',
          totalTasks: { $sum: 1 },
          completedTasks: {
            $sum: {
              $cond: [
                { $in: ['$status', [CLEANING_TASK_STATUSES.COMPLETED, CLEANING_TASK_STATUSES.VERIFIED]] },
                1,
                0,
              ],
            },
          },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      {
        $project: {
          staffId: '$_id',
          name: '$user.name',
          email: '$user.email',
          totalTasks: 1,
          completedTasks: 1,
        },
      },
    ]),
  ]);

  const avgScore = qualityAgg.length > 0 ? Number(qualityAgg[0].avgQualityScore.toFixed(2)) : 5.0;
  const verificationRate =
    tasksTodayCompleted > 0
      ? Number(((tasksTodayVerified / tasksTodayCompleted) * 100).toFixed(1))
      : 100;

  return {
    summary: {
      totalAreas,
      activePlans,
      tasksToday: tasksTodayTotal,
      completedToday: tasksTodayCompleted,
      verifiedToday: tasksTodayVerified,
      inProgressToday: tasksTodayInProgress,
      totalOverdue,
      totalMissed,
      avgQualityScore: avgScore,
      verificationRate,
    },
    staffWorkload,
  };
};
