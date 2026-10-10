import Complaint from '../models/Complaint.js';
import ComplaintAssignment from '../models/ComplaintAssignment.js';
import ComplaintResolution from '../models/ComplaintResolution.js';
import User from '../models/User.js';
import Department from '../models/Department.js';
import Mess from '../models/Mess.js';
import { getNextSequence } from '../models/Counter.js';
import {
  COMPLAINT_STATUSES,
  ASSIGNMENT_TYPES,
  COMPLAINT_CATEGORIES,
  COMPLAINT_PRIORITIES,
  VERIFICATION_DECISIONS,
} from '../constants/complaint.constants.js';
import { ROLES } from '../constants/roles.js';
import {
  startSlaForComplaint,
  completeSlaForComplaint,
  getComplaintSlaInfo,
  getComplaintEscalationHistory,
} from './sla.service.js';
import {
  createNotification,
  createBatchNotifications,
} from './notification.service.js';
import { NOTIFICATION_TYPES } from '../constants/notification.constants.js';

/**
 * Generate human-readable atomic complaint ID: CMP-YYYY-XXXXX
 * e.g. CMP-2026-00001
 */
export const generateComplaintId = async () => {
  const year = new Date().getFullYear();
  const sequenceKey = `complaint_${year}`;

  let attempts = 0;
  while (attempts < 5) {
    const seq = await getNextSequence(sequenceKey);
    const complaintId = `CMP-${year}-${String(seq).padStart(5, '0')}`;

    const existing = await Complaint.findOne({ complaintId }).lean();
    if (!existing) {
      return complaintId;
    }
    attempts += 1;
  }

  // Fallback with timestamp suffix if sequence collision happens
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `CMP-${year}-${randomSuffix}`;
};

/**
 * Helper to find complaint by ObjectId or human-readable complaintId
 */
export const findComplaintDoc = (idOrComplaintId) => {
  let query;
  if (idOrComplaintId.match(/^[0-9a-fA-F]{24}$/)) {
    query = { _id: idOrComplaintId };
  } else {
    query = { complaintId: idOrComplaintId.toUpperCase() };
  }
  return Complaint.findOne(query);
};

/**
 * Create a new complaint submitted by an authenticated student
 */
export const createStudentComplaint = async (studentUserId, complaintData) => {
  // 1. Fetch fresh student profile to get verified location hierarchy
  const student = await User.findById(studentUserId).lean();
  if (!student) {
    const error = new Error('Student account not found');
    error.statusCode = 404;
    throw error;
  }

  // 2. Validate student has residential accommodation assigned (auto-assign if unassigned)
  if (!student.hostelId || !student.roomId) {
    const HostelModel = (await import('../models/Hostel.js')).default;
    const RoomModel = (await import('../models/Room.js')).default;
    const hostel = await HostelModel.findOne({ isActive: true });
    const room = hostel ? await RoomModel.findOne({ hostelId: hostel._id, isActive: true }) : null;

    if (hostel && room) {
      await User.findByIdAndUpdate(studentUserId, {
        hostelId: hostel._id,
        blockId: room.blockId,
        floorId: room.floorId,
        roomId: room._id,
        roomNumber: room.roomNumber,
      });
      student.hostelId = hostel._id;
      student.blockId = room.blockId;
      student.floorId = room.floorId;
      student.roomId = room._id;
      student.roomNumber = room.roomNumber;
    } else {
      const error = new Error(
        'Your hostel/room is not assigned yet. Please contact the hostel administrator.'
      );
      error.statusCode = 400;
      throw error;
    }
  }

  // 3. Map category to department if matching department exists
  let departmentId = null;
  const deptCodeMap = {
    ELECTRICAL: 'ELEC',
    PLUMBING: 'PLUMB',
    CLEANING: 'HOUSEKEEPING',
    INTERNET: 'IT_NETWORK',
    WATER: 'WATER_MAINT',
    MESS: 'MESS_SERVICES',
  };

  const candidateCode = deptCodeMap[complaintData.category];
  if (candidateCode) {
    const dept = await Department.findOne({ code: candidateCode, isActive: true }).select('_id').lean();
    if (dept) {
      departmentId = dept._id;
    }
  }

  // 4. Resolve messId if category is MESS
  let messId = complaintData.messId || null;
  if (!messId && complaintData.category === 'MESS') {
    const defaultMess = await Mess.findOne({ hostelId: student.hostelId, isActive: true }).select('_id').lean();
    if (defaultMess) {
      messId = defaultMess._id;
    }
  }

  // 5. Attachment Metadata
  let attachmentUrl = null;
  let attachmentFilename = null;
  let attachmentOriginalName = null;
  let attachmentMimeType = null;
  let attachmentSize = null;

  if (complaintData.file) {
    attachmentUrl = `/uploads/complaints/${complaintData.file.filename}`;
    attachmentFilename = complaintData.file.filename;
    attachmentOriginalName = complaintData.file.originalname;
    attachmentMimeType = complaintData.file.mimetype;
    attachmentSize = complaintData.file.size;
  }

  // 6. Generate unique complaint ID
  const complaintId = await generateComplaintId();

  // 7. Construct complaint document
  const complaint = await Complaint.create({
    complaintId,
    title: complaintData.title.trim(),
    description: complaintData.description.trim(),
    category: complaintData.category,
    issueType: complaintData.issueType,
    priority: complaintData.priority,
    status: COMPLAINT_STATUSES.SUBMITTED,
    studentId: student._id,
    hostelId: student.hostelId,
    blockId: student.blockId,
    floorId: student.floorId,
    roomId: student.roomId,
    departmentId,
    messId,
    mealType: complaintData.mealType || null,
    mealDate: complaintData.mealDate ? new Date(complaintData.mealDate) : null,
    cleaningAreaId: complaintData.cleaningAreaId || null,
    cleaningPlanId: complaintData.cleaningPlanId || null,
    cleaningTaskId: complaintData.cleaningTaskId || null,
    locationDescription: complaintData.locationDescription?.trim() || '',
    attachmentUrl,
    attachmentFilename,
    attachmentOriginalName,
    attachmentMimeType,
    attachmentSize,
    submittedAt: new Date(),
  });

  // Trigger submission notifications
  Promise.resolve().then(async () => {
    try {
      // 1. Notify Student
      await createNotification({
        recipient: student._id,
        type: NOTIFICATION_TYPES.COMPLAINT_SUBMITTED,
        title: 'Complaint Submitted',
        message: `Your complaint #${complaint.complaintId} (${complaint.title}) was submitted successfully.`,
        relatedEntityType: 'COMPLAINT',
        relatedEntityId: complaint._id,
        metadata: { complaintId: complaint.complaintId, priority: complaint.priority },
      });

      // 2. Notify Warden(s) assigned to this hostel
      const wardens = await User.find({
        role: ROLES.WARDEN,
        hostelId: student.hostelId,
        isActive: true,
      }).select('_id').lean();

      if (wardens.length > 0) {
        await createBatchNotifications(
          wardens.map((w) => w._id),
          {
            type: NOTIFICATION_TYPES.COMPLAINT_SUBMITTED,
            title: 'New Complaint Registered',
            message: `New complaint #${complaint.complaintId} (${complaint.title}) submitted in your hostel.`,
            relatedEntityType: 'COMPLAINT',
            relatedEntityId: complaint._id,
            metadata: { complaintId: complaint.complaintId, priority: complaint.priority },
          }
        );
      }
    } catch (e) {
      console.error('[complaintService] Error dispatching submission notification:', e.message);
    }
  });

  return Complaint.findById(complaint._id)
    .populate('hostelId', 'name code type')
    .populate('blockId', 'name code')
    .populate('floorId', 'floorNumber name')
    .populate('roomId', 'roomNumber roomType')
    .populate('departmentId', 'name code');
};

/**
 * Retrieve complaints for a specific student with optional search/filters
 */
export const getStudentComplaints = async (studentUserId, queryParams = {}) => {
  const filter = { studentId: studentUserId };

  if (queryParams.status) {
    filter.status = queryParams.status;
  }
  if (queryParams.category) {
    filter.category = queryParams.category;
  }
  if (queryParams.priority) {
    filter.priority = queryParams.priority;
  }
  if (queryParams.search) {
    const q = queryParams.search.trim();
    filter.$or = [
      { complaintId: { $regex: q, $options: 'i' } },
      { title: { $regex: q, $options: 'i' } },
    ];
  }

  return Complaint.find(filter)
    .sort({ createdAt: -1 })
    .populate('hostelId', 'name code type')
    .populate('blockId', 'name code')
    .populate('floorId', 'floorNumber name')
    .populate('roomId', 'roomNumber roomType')
    .populate('departmentId', 'name code')
    .lean();
};

/**
 * Server-side role-filtered complaint query
 * Used by WARDEN, HOSTEL_STAFF, AUTHORITY, SUPER_ADMIN
 */
export const getComplaints = async (requestingUser, queryParams = {}) => {
  const filter = {};

  // 1. Role-based scoping
  if (requestingUser.role === ROLES.STUDENT) {
    filter.studentId = requestingUser._id;
  } else if (requestingUser.role === ROLES.WARDEN) {
    if (requestingUser.hostelId) {
      filter.hostelId = requestingUser.hostelId;
    }
  } else if (requestingUser.role === ROLES.HOSTEL_STAFF) {
    // Show complaints specifically assigned to them OR matching their hostel/department
    const staffOrConditions = [{ assignedTo: requestingUser._id }];
    if (requestingUser.departmentId) {
      staffOrConditions.push({ departmentId: requestingUser.departmentId });
    }
    filter.$or = staffOrConditions;
  }
  // AUTHORITY and SUPER_ADMIN see all (unless filtered by query)

  // 2. Query filters
  if (queryParams.status) {
    filter.status = queryParams.status;
  }
  if (queryParams.category) {
    filter.category = queryParams.category;
  }
  if (queryParams.priority) {
    filter.priority = queryParams.priority;
  }
  if (queryParams.departmentId) {
    filter.departmentId = queryParams.departmentId;
  }
  if (queryParams.assignedTo) {
    filter.assignedTo = queryParams.assignedTo;
  }
  if (queryParams.hostelId && (requestingUser.role === ROLES.AUTHORITY || requestingUser.role === ROLES.SUPER_ADMIN)) {
    filter.hostelId = queryParams.hostelId;
  }

  // SLA Filters
  if (queryParams.slaStatus) {
    filter.slaStatus = queryParams.slaStatus;
  }
  if (queryParams.escalated === 'true' || queryParams.escalated === true) {
    filter.currentEscalationLevel = { $gt: 0 };
  }
  if (queryParams.escalationLevel !== undefined && queryParams.escalationLevel !== '') {
    filter.currentEscalationLevel = Number(queryParams.escalationLevel);
  }
  if (queryParams.dueSoon === 'true' || queryParams.dueSoon === true) {
    const now = new Date();
    const fourHoursFromNow = new Date(now.getTime() + 4 * 3600 * 1000);
    filter.slaStatus = 'ACTIVE';
    filter.slaDueAt = { $gte: now, $lte: fourHoursFromNow };
  }

  if (queryParams.search) {
    const q = queryParams.search.trim();
    const searchFilter = [
      { complaintId: { $regex: q, $options: 'i' } },
      { title: { $regex: q, $options: 'i' } },
    ];
    if (filter.$or) {
      filter.$and = [{ $or: filter.$or }, { $or: searchFilter }];
      delete filter.$or;
    } else {
      filter.$or = searchFilter;
    }
  }

  return Complaint.find(filter)
    .sort({ createdAt: -1 })
    .populate('studentId', 'name email studentId phone')
    .populate('hostelId', 'name code type')
    .populate('blockId', 'name code')
    .populate('floorId', 'floorNumber name')
    .populate('roomId', 'roomNumber roomType')
    .populate('departmentId', 'name code')
    .populate('assignedTo', 'name email role phone')
    .lean();
};

/**
 * Get single complaint by ID or complaintId, with strict role-based access checks
 */
export const getComplaintById = async (idOrComplaintId, requestingUser) => {
  const complaint = await findComplaintDoc(idOrComplaintId)
    .populate('studentId', 'name email studentId phone')
    .populate('hostelId', 'name code type address')
    .populate('blockId', 'name code')
    .populate('floorId', 'floorNumber name')
    .populate('roomId', 'roomNumber roomType capacity currentOccupancy')
    .populate('departmentId', 'name code')
    .populate('assignedTo', 'name email role phone')
    .populate('triagedBy', 'name email role')
    .populate('acknowledgedBy', 'name email role')
    .populate('resolvedBy', 'name email role employeeId')
    .populate('verifiedBy', 'name email role studentId')
    .populate('reopenedBy', 'name email role studentId')
    .populate('slaRuleId')
    .lean();

  if (!complaint) {
    const error = new Error('Complaint not found');
    error.statusCode = 404;
    throw error;
  }

  // Role permissions check
  if (requestingUser.role === ROLES.STUDENT) {
    const ownerId = complaint.studentId?._id || complaint.studentId;
    if (String(ownerId) !== String(requestingUser._id)) {
      const error = new Error('You are not authorized to access this complaint');
      error.statusCode = 403;
      throw error;
    }
  } else if (requestingUser.role === ROLES.WARDEN) {
    const complaintHostelId = complaint.hostelId?._id || complaint.hostelId;
    if (requestingUser.hostelId && String(complaintHostelId) !== String(requestingUser.hostelId)) {
      const error = new Error('You are not authorized to view complaints outside your assigned hostel');
      error.statusCode = 403;
      throw error;
    }
  }

  // Attach real-time calculated SLA details & escalations
  const slaInfo = await getComplaintSlaInfo(complaint._id);
  const escalations = await getComplaintEscalationHistory(complaint._id);
  complaint.sla = slaInfo;
  complaint.escalations = escalations;

  return complaint;
};

/**
 * Triage Complaint (Action: SUBMITTED -> TRIAGED)
 * Allowed roles: WARDEN, AUTHORITY, SUPER_ADMIN
 */
export const triageComplaint = async (idOrComplaintId, triageData, triagedByUser) => {
  const complaint = await findComplaintDoc(idOrComplaintId);
  if (!complaint) {
    const error = new Error('Complaint not found');
    error.statusCode = 404;
    throw error;
  }

  // Warden jurisdiction check
  if (triagedByUser.role === ROLES.WARDEN) {
    if (triagedByUser.hostelId && String(complaint.hostelId) !== String(triagedByUser.hostelId)) {
      const error = new Error('You can only triage complaints belonging to your assigned hostel');
      error.statusCode = 403;
      throw error;
    }
  }

  // State Transition check: Must be in SUBMITTED status
  if (complaint.status !== COMPLAINT_STATUSES.SUBMITTED) {
    const error = new Error(
      `Cannot triage complaint in '${complaint.status}' status. Only '${COMPLAINT_STATUSES.SUBMITTED}' complaints can be triaged.`
    );
    error.statusCode = 400;
    throw error;
  }

  // Optional category/priority/issueType adjustments
  if (triageData.category) {
    if (!Object.values(COMPLAINT_CATEGORIES).includes(triageData.category)) {
      const error = new Error('Invalid complaint category');
      error.statusCode = 400;
      throw error;
    }
    complaint.category = triageData.category;
  }

  if (triageData.issueType) {
    complaint.issueType = triageData.issueType;
  }

  if (triageData.priority) {
    if (!Object.values(COMPLAINT_PRIORITIES).includes(triageData.priority)) {
      const error = new Error('Invalid priority');
      error.statusCode = 400;
      throw error;
    }
    complaint.priority = triageData.priority;
  }

  // Optional manual department linkage during triage
  if (triageData.departmentId) {
    const dept = await Department.findById(triageData.departmentId).lean();
    if (!dept || !dept.isActive) {
      const error = new Error('Selected department does not exist or is inactive');
      error.statusCode = 400;
      throw error;
    }
    complaint.departmentId = dept._id;
  }

  complaint.status = COMPLAINT_STATUSES.TRIAGED;
  complaint.triageNote = triageData.triageNote?.trim() || '';
  complaint.triagedBy = triagedByUser._id;
  complaint.triagedAt = new Date();

  await complaint.save();

  return getComplaintById(complaint._id.toString(), triagedByUser);
};

/**
 * A warden may only hand complaints to staff of their own hostel. Staff with no hostel
 * set are allowed (legacy data); staff of a different hostel are refused.
 */
const assertWardenMayAssignTo = (actor, assignee) => {
  if (actor?.role !== ROLES.WARDEN || !actor.hostelId) return;
  if (assignee.hostelId && String(assignee.hostelId) !== String(actor.hostelId)) {
    const error = new Error('You can only assign complaints to staff of your own hostel');
    error.statusCode = 403;
    throw error;
  }
};

/**
 * Get active staff eligible for complaint assignment
 */
export const getEligibleAssignees = async (idOrComplaintId, requestingUser) => {
  const complaint = await findComplaintDoc(idOrComplaintId);
  if (!complaint) {
    const error = new Error('Complaint not found');
    error.statusCode = 404;
    throw error;
  }

  // Eligible query: active users with role HOSTEL_STAFF or WARDEN
  const staffFilter = {
    isActive: true,
    role: { $in: [ROLES.HOSTEL_STAFF, ROLES.WARDEN] },
  };

  // A warden must not be shown (or be able to assign to) staff of another hostel.
  // Staff not yet tied to any hostel stay selectable so existing data keeps working.
  if (requestingUser?.role === ROLES.WARDEN && requestingUser.hostelId) {
    staffFilter.$or = [
      { hostelId: requestingUser.hostelId },
      { hostelId: null },
      { hostelId: { $exists: false } },
    ];
  }

  // If complaint has a department, optionally filter or list all staff
  const staffMembers = await User.find(staffFilter)
    .populate('departmentId', 'name code')
    .populate('hostelId', 'name code')
    .select('name email role phone employeeId departmentId hostelId')
    .sort({ name: 1 })
    .lean();

  return staffMembers;
};

/**
 * Assign Complaint (Action: TRIAGED -> ASSIGNED)
 * Allowed roles: WARDEN, AUTHORITY, SUPER_ADMIN
 */
export const assignComplaint = async (idOrComplaintId, { departmentId, assignedTo, reason }, assignedByUser) => {
  const complaint = await findComplaintDoc(idOrComplaintId);
  if (!complaint) {
    const error = new Error('Complaint not found');
    error.statusCode = 404;
    throw error;
  }

  // Warden check
  if (assignedByUser.role === ROLES.WARDEN) {
    if (assignedByUser.hostelId && String(complaint.hostelId) !== String(assignedByUser.hostelId)) {
      const error = new Error('You can only assign complaints belonging to your assigned hostel');
      error.statusCode = 403;
      throw error;
    }
  }

  // Status transition check: Must be in TRIAGED status
  if (complaint.status !== COMPLAINT_STATUSES.TRIAGED) {
    const error = new Error(
      `Cannot assign complaint in '${complaint.status}' status. Triage must be performed first (status must be '${COMPLAINT_STATUSES.TRIAGED}').`
    );
    error.statusCode = 400;
    throw error;
  }

  // Validate Department (fallback to complaint.departmentId if already triaged)
  const targetDeptId = departmentId || complaint.departmentId;
  if (!targetDeptId) {
    const error = new Error('Department selection is required for assignment');
    error.statusCode = 400;
    throw error;
  }
  const dept = await Department.findById(targetDeptId).lean();
  if (!dept || !dept.isActive) {
    const error = new Error('Selected department does not exist or is inactive');
    error.statusCode = 400;
    throw error;
  }

  // Validate Assignee
  if (!assignedTo) {
    const error = new Error('Assignee staff member is required');
    error.statusCode = 400;
    throw error;
  }
  const assignee = await User.findById(assignedTo).lean();
  if (!assignee) {
    const error = new Error('Assignee user not found');
    error.statusCode = 404;
    throw error;
  }
  if (!assignee.isActive) {
    const error = new Error('Cannot assign complaint to an inactive user');
    error.statusCode = 400;
    throw error;
  }
  if (![ROLES.HOSTEL_STAFF, ROLES.WARDEN].includes(assignee.role)) {
    const error = new Error(`Cannot assign complaints to user with role '${assignee.role}'`);
    error.statusCode = 400;
    throw error;
  }
  assertWardenMayAssignTo(assignedByUser, assignee);

  // Deactivate any previous current assignments if they exist
  await ComplaintAssignment.updateMany(
    { complaintId: complaint._id, isCurrent: true },
    { $set: { isCurrent: false, unassignedAt: new Date() } }
  );

  // Create Assignment History Record
  await ComplaintAssignment.create({
    complaintId: complaint._id,
    assignedBy: assignedByUser._id,
    assignedTo: assignee._id,
    departmentId: dept._id,
    previousAssignee: complaint.assignedTo || null,
    assignmentType: ASSIGNMENT_TYPES.MANUAL,
    reason: reason?.trim() || 'Initial assignment following triage',
    assignedAt: new Date(),
    isCurrent: true,
  });

  // Update complaint document
  complaint.status = COMPLAINT_STATUSES.ASSIGNED;
  complaint.departmentId = dept._id;
  complaint.assignedTo = assignee._id;
  complaint.assignedAt = new Date();
  await complaint.save();

  // Start authoritative server-side SLA cycle
  await startSlaForComplaint(complaint);

  // Trigger assignment notifications
  Promise.resolve().then(async () => {
    try {
      // 1. Notify Assigned Staff
      await createNotification({
        recipient: assignee._id,
        type: NOTIFICATION_TYPES.COMPLAINT_ASSIGNED,
        title: 'New Complaint Assigned',
        message: `Complaint #${complaint.complaintId} (${complaint.title}) has been assigned to you.`,
        relatedEntityType: 'COMPLAINT',
        relatedEntityId: complaint._id,
        metadata: { complaintId: complaint.complaintId, priority: complaint.priority },
      });

      // 2. Notify Student
      await createNotification({
        recipient: complaint.studentId,
        type: NOTIFICATION_TYPES.COMPLAINT_ASSIGNED,
        title: 'Complaint Assigned to Staff',
        message: `Your complaint #${complaint.complaintId} has been assigned to ${assignee.name} (${assignee.role}).`,
        relatedEntityType: 'COMPLAINT',
        relatedEntityId: complaint._id,
        metadata: { complaintId: complaint.complaintId, priority: complaint.priority },
      });
    } catch (e) {
      console.error('[complaintService] Error dispatching assignment notification:', e.message);
    }
  });

  return getComplaintById(complaint._id.toString(), assignedByUser);
};

/**
 * Reassign Complaint
 * Allowed roles: WARDEN, AUTHORITY, SUPER_ADMIN
 * Status must be ASSIGNED, ACKNOWLEDGED, or IN_PROGRESS
 */
export const reassignComplaint = async (idOrComplaintId, { assignedTo, reason, departmentId }, reassignedByUser) => {
  const complaint = await findComplaintDoc(idOrComplaintId);
  if (!complaint) {
    const error = new Error('Complaint not found');
    error.statusCode = 404;
    throw error;
  }

  // Warden check
  if (reassignedByUser.role === ROLES.WARDEN) {
    if (reassignedByUser.hostelId && String(complaint.hostelId) !== String(reassignedByUser.hostelId)) {
      const error = new Error('You can only reassign complaints belonging to your assigned hostel');
      error.statusCode = 403;
      throw error;
    }
  }

  // Status check: must be in ASSIGNED, ACKNOWLEDGED, or IN_PROGRESS
  const allowedReassignStatuses = [
    COMPLAINT_STATUSES.ASSIGNED,
    COMPLAINT_STATUSES.ACKNOWLEDGED,
    COMPLAINT_STATUSES.IN_PROGRESS,
  ];
  if (!allowedReassignStatuses.includes(complaint.status)) {
    const error = new Error(
      `Cannot reassign complaint in '${complaint.status}' status. Allowed statuses: ${allowedReassignStatuses.join(', ')}`
    );
    error.statusCode = 400;
    throw error;
  }

  // Reassignment reason is mandatory
  if (!reason || !reason.trim() || reason.trim().length < 5) {
    const error = new Error('A valid reason (at least 5 characters) is required when reassigning a complaint');
    error.statusCode = 400;
    throw error;
  }

  // Validate new assignee
  if (!assignedTo) {
    const error = new Error('New assignee is required');
    error.statusCode = 400;
    throw error;
  }
  if (complaint.assignedTo && String(complaint.assignedTo) === String(assignedTo)) {
    const error = new Error('Complaint is already assigned to this user');
    error.statusCode = 400;
    throw error;
  }

  const newAssignee = await User.findById(assignedTo).lean();
  if (!newAssignee || !newAssignee.isActive) {
    const error = new Error('New assignee user does not exist or is inactive');
    error.statusCode = 400;
    throw error;
  }
  if (![ROLES.HOSTEL_STAFF, ROLES.WARDEN].includes(newAssignee.role)) {
    const error = new Error(`Cannot assign complaints to user with role '${newAssignee.role}'`);
    error.statusCode = 400;
    throw error;
  }
  assertWardenMayAssignTo(reassignedByUser, newAssignee);

  // Optional department update
  let targetDeptId = complaint.departmentId;
  if (departmentId) {
    const dept = await Department.findById(departmentId).lean();
    if (dept && dept.isActive) {
      targetDeptId = dept._id;
    }
  }

  const previousAssigneeId = complaint.assignedTo;

  // Mark current assignment as no longer current
  await ComplaintAssignment.updateMany(
    { complaintId: complaint._id, isCurrent: true },
    { $set: { isCurrent: false, unassignedAt: new Date() } }
  );

  // Create new assignment history record
  await ComplaintAssignment.create({
    complaintId: complaint._id,
    assignedBy: reassignedByUser._id,
    assignedTo: newAssignee._id,
    departmentId: targetDeptId,
    previousAssignee: previousAssigneeId,
    assignmentType: ASSIGNMENT_TYPES.MANUAL,
    reason: reason.trim(),
    assignedAt: new Date(),
    isCurrent: true,
  });

  // Reset status to ASSIGNED for the new assignee
  complaint.assignedTo = newAssignee._id;
  complaint.departmentId = targetDeptId;
  complaint.assignedAt = new Date();
  complaint.status = COMPLAINT_STATUSES.ASSIGNED;
  complaint.acknowledgedAt = null;
  complaint.acknowledgedBy = null;
  complaint.startedAt = null;
  await complaint.save();

  // Restart authoritative SLA cycle for new assignee
  await startSlaForComplaint(complaint);

  // Trigger reassignment notifications
  Promise.resolve().then(async () => {
    try {
      // 1. Notify New Assignee
      await createNotification({
        recipient: newAssignee._id,
        type: NOTIFICATION_TYPES.COMPLAINT_ASSIGNED,
        title: 'Complaint Reassigned to You',
        message: `Complaint #${complaint.complaintId} (${complaint.title}) has been reassigned to you.`,
        relatedEntityType: 'COMPLAINT',
        relatedEntityId: complaint._id,
        metadata: { complaintId: complaint.complaintId, priority: complaint.priority },
      });

      // 2. Notify Previous Assignee if applicable
      if (previousAssigneeId && String(previousAssigneeId) !== String(newAssignee._id)) {
        await createNotification({
          recipient: previousAssigneeId,
          type: NOTIFICATION_TYPES.COMPLAINT_STATUS_CHANGED,
          title: 'Complaint Reassigned',
          message: `Complaint #${complaint.complaintId} previously assigned to you has been reassigned.`,
          relatedEntityType: 'COMPLAINT',
          relatedEntityId: complaint._id,
          metadata: { complaintId: complaint.complaintId },
        });
      }

      // 3. Notify Student
      if (complaint.studentId) {
        await createNotification({
          recipient: complaint.studentId,
          type: NOTIFICATION_TYPES.COMPLAINT_STATUS_CHANGED,
          title: 'Complaint Assignee Updated',
          message: `Your complaint #${complaint.complaintId} is now assigned to ${newAssignee.name}.`,
          relatedEntityType: 'COMPLAINT',
          relatedEntityId: complaint._id,
          metadata: { complaintId: complaint.complaintId },
        });
      }
    } catch (e) {
      console.error('[complaintService] Error dispatching reassignment notification:', e.message);
    }
  });

  return getComplaintById(complaint._id.toString(), reassignedByUser);
};

/**
 * Acknowledge Complaint (Action: ASSIGNED -> ACKNOWLEDGED)
 * Allowed roles: Current assigned staff member OR Warden / Super Admin supervisor
 */
export const acknowledgeComplaint = async (idOrComplaintId, acknowledgingUser) => {
  const complaint = await findComplaintDoc(idOrComplaintId);
  if (!complaint) {
    const error = new Error('Complaint not found');
    error.statusCode = 404;
    throw error;
  }

  // Permission check: Must be the assigned staff member, or supervising Warden/Admin
  const isAssignee = complaint.assignedTo && String(complaint.assignedTo) === String(acknowledgingUser._id);
  const isSupervisor = [ROLES.WARDEN, ROLES.SUPER_ADMIN].includes(acknowledgingUser.role);

  if (!isAssignee && !isSupervisor) {
    const error = new Error('You are not authorized to acknowledge this complaint. Only the assignee can acknowledge.');
    error.statusCode = 403;
    throw error;
  }

  // Status check: Must be ASSIGNED
  if (complaint.status !== COMPLAINT_STATUSES.ASSIGNED) {
    const error = new Error(
      `Cannot acknowledge complaint in '${complaint.status}' status. Only '${COMPLAINT_STATUSES.ASSIGNED}' complaints can be acknowledged.`
    );
    error.statusCode = 400;
    throw error;
  }

  const now = new Date();

  // Update assignment record acknowledgedAt
  await ComplaintAssignment.updateOne(
    { complaintId: complaint._id, isCurrent: true },
    { $set: { acknowledgedAt: now } }
  );

  complaint.status = COMPLAINT_STATUSES.ACKNOWLEDGED;
  complaint.acknowledgedAt = now;
  complaint.acknowledgedBy = acknowledgingUser._id;
  await complaint.save();

  // Trigger acknowledgment notification
  Promise.resolve().then(async () => {
    try {
      if (complaint.studentId) {
        await createNotification({
          recipient: complaint.studentId,
          type: NOTIFICATION_TYPES.COMPLAINT_ACKNOWLEDGED,
          title: 'Complaint Acknowledged',
          message: `Your complaint #${complaint.complaintId} has been acknowledged by staff and is queued for action.`,
          relatedEntityType: 'COMPLAINT',
          relatedEntityId: complaint._id,
          metadata: { complaintId: complaint.complaintId },
        });
      }
    } catch (e) {
      console.error('[complaintService] Error dispatching acknowledgment notification:', e.message);
    }
  });

  return getComplaintById(complaint._id.toString(), acknowledgingUser);
};

/**
 * Start Work on Complaint (Action: ACKNOWLEDGED -> IN_PROGRESS)
 * Allowed roles: Current assigned staff member
 */
export const startWorkOnComplaint = async (idOrComplaintId, startingUser) => {
  const complaint = await findComplaintDoc(idOrComplaintId);
  if (!complaint) {
    const error = new Error('Complaint not found');
    error.statusCode = 404;
    throw error;
  }

  // Permission check: Must be the assigned staff member or Super Admin
  const isAssignee = complaint.assignedTo && String(complaint.assignedTo) === String(startingUser._id);
  const isAdmin = startingUser.role === ROLES.SUPER_ADMIN;

  if (!isAssignee && !isAdmin) {
    const error = new Error('Only the assigned staff member can mark work started on this complaint.');
    error.statusCode = 403;
    throw error;
  }

  // Status check: Must be ACKNOWLEDGED
  if (complaint.status !== COMPLAINT_STATUSES.ACKNOWLEDGED) {
    const error = new Error(
      `Cannot start work on complaint in '${complaint.status}' status. Ticket must be acknowledged first (status '${COMPLAINT_STATUSES.ACKNOWLEDGED}').`
    );
    error.statusCode = 400;
    throw error;
  }

  complaint.status = COMPLAINT_STATUSES.IN_PROGRESS;
  complaint.startedAt = new Date();
  await complaint.save();

  // Trigger start work notification
  Promise.resolve().then(async () => {
    try {
      if (complaint.studentId) {
        await createNotification({
          recipient: complaint.studentId,
          type: NOTIFICATION_TYPES.COMPLAINT_STATUS_CHANGED,
          title: 'Work In Progress',
          message: `Staff has begun work on your complaint #${complaint.complaintId}.`,
          relatedEntityType: 'COMPLAINT',
          relatedEntityId: complaint._id,
          metadata: { complaintId: complaint.complaintId, status: COMPLAINT_STATUSES.IN_PROGRESS },
        });
      }
    } catch (e) {
      console.error('[complaintService] Error dispatching start work notification:', e.message);
    }
  });

  return getComplaintById(complaint._id.toString(), startingUser);
};

/**
 * Retrieve Assignment History for a complaint
 */
export const getComplaintAssignments = async (idOrComplaintId, requestingUser) => {
  const complaint = await findComplaintDoc(idOrComplaintId);
  if (!complaint) {
    const error = new Error('Complaint not found');
    error.statusCode = 404;
    throw error;
  }

  // Role permissions check
  if (requestingUser.role === ROLES.STUDENT) {
    if (String(complaint.studentId) !== String(requestingUser._id)) {
      const error = new Error('You are not authorized to view assignment history for this complaint');
      error.statusCode = 403;
      throw error;
    }
  }

  return ComplaintAssignment.find({ complaintId: complaint._id })
    .sort({ assignedAt: -1 })
    .populate('assignedBy', 'name email role')
    .populate('assignedTo', 'name email role phone employeeId')
    .populate('previousAssignee', 'name email role')
    .populate('departmentId', 'name code')
    .lean();
};

/**
 * Resolve Complaint (Action: IN_PROGRESS -> STUDENT_VERIFICATION)
 * Roles: HOSTEL_STAFF (must be current assignee or super admin), WARDEN (assigned hostel), AUTHORITY, SUPER_ADMIN
 */
export const resolveComplaint = async (idOrComplaintId, { resolutionNote }, resolvingUser) => {
  const complaint = await findComplaintDoc(idOrComplaintId);
  if (!complaint) {
    const error = new Error('Complaint not found');
    error.statusCode = 404;
    throw error;
  }

  // RBAC checks
  if (resolvingUser.role === ROLES.STUDENT) {
    const error = new Error('Students are not authorized to resolve complaints');
    error.statusCode = 403;
    throw error;
  }

  if (resolvingUser.role === ROLES.HOSTEL_STAFF) {
    const currentAssigneeId = complaint.assignedTo?._id || complaint.assignedTo;
    if (!currentAssigneeId || String(currentAssigneeId) !== String(resolvingUser._id)) {
      const error = new Error('You can only resolve complaints that are assigned to you');
      error.statusCode = 403;
      throw error;
    }
  } else if (resolvingUser.role === ROLES.WARDEN) {
    const complaintHostelId = complaint.hostelId?._id || complaint.hostelId;
    if (resolvingUser.hostelId && String(complaintHostelId) !== String(resolvingUser.hostelId)) {
      const error = new Error('You can only resolve complaints belonging to your assigned hostel');
      error.statusCode = 403;
      throw error;
    }
  }

  // Status transition check: Must be in IN_PROGRESS
  if (complaint.status !== COMPLAINT_STATUSES.IN_PROGRESS) {
    const error = new Error(
      `Cannot resolve complaint in '${complaint.status}' status. Only '${COMPLAINT_STATUSES.IN_PROGRESS}' complaints can be resolved.`
    );
    error.statusCode = 400;
    throw error;
  }

  // Validation: resolutionNote
  if (!resolutionNote || typeof resolutionNote !== 'string' || !resolutionNote.trim() || resolutionNote.trim().length < 5) {
    const error = new Error('A detailed resolution note (at least 5 characters) is required');
    error.statusCode = 400;
    throw error;
  }

  if (resolutionNote.trim().length > 2000) {
    const error = new Error('Resolution note cannot exceed 2000 characters');
    error.statusCode = 400;
    throw error;
  }

  const now = new Date();
  const trimmedNote = resolutionNote.trim();

  // Create permanent history record in ComplaintResolution
  const attemptNumber = (complaint.reopenCount || 0) + 1;
  await ComplaintResolution.create({
    complaintId: complaint._id,
    attemptNumber,
    resolvedBy: resolvingUser._id,
    resolutionNote: trimmedNote,
    resolvedAt: now,
  });

  // Transition status to STUDENT_VERIFICATION
  complaint.status = COMPLAINT_STATUSES.STUDENT_VERIFICATION;
  complaint.resolutionNote = trimmedNote;
  complaint.resolvedBy = resolvingUser._id;
  complaint.resolvedAt = now;
  complaint.verificationRequestedAt = now;
  complaint.reopenReason = '';

  await complaint.save();

  // Complete operational SLA cycle upon resolution
  await completeSlaForComplaint(complaint);

  // Trigger resolution notification to student
  Promise.resolve().then(async () => {
    try {
      if (complaint.studentId) {
        await createNotification({
          recipient: complaint.studentId,
          type: NOTIFICATION_TYPES.COMPLAINT_RESOLVED,
          title: 'Resolution Submitted - Verification Needed',
          message: `Complaint #${complaint.complaintId} has been resolved. Please review and confirm if the issue is solved.`,
          relatedEntityType: 'COMPLAINT',
          relatedEntityId: complaint._id,
          metadata: {
            complaintId: complaint.complaintId,
            status: COMPLAINT_STATUSES.STUDENT_VERIFICATION,
          },
        });
      }
    } catch (e) {
      console.error('[complaintService] Error dispatching resolution notification:', e.message);
    }
  });

  return getComplaintById(complaint._id.toString(), resolvingUser);
};

/**
 * Student Verification of Resolution
 * Action: STUDENT_VERIFICATION -> CLOSED (if ACCEPT) or REOPENED (if REJECT)
 * Roles: STUDENT (must be original complainant) or SUPER_ADMIN
 */
export const verifyComplaint = async (idOrComplaintId, { decision, verificationNote, reopenReason }, verifyingUser) => {
  const complaint = await findComplaintDoc(idOrComplaintId);
  if (!complaint) {
    const error = new Error('Complaint not found');
    error.statusCode = 404;
    throw error;
  }

  // RBAC checks
  if (verifyingUser.role !== ROLES.STUDENT && verifyingUser.role !== ROLES.SUPER_ADMIN) {
    const error = new Error('Only resident students can verify resolution of their complaints');
    error.statusCode = 403;
    throw error;
  }

  // Must be owner student
  const studentOwnerId = complaint.studentId?._id || complaint.studentId;
  if (verifyingUser.role === ROLES.STUDENT && String(studentOwnerId) !== String(verifyingUser._id)) {
    const error = new Error('You are not authorized to verify another student\'s complaint');
    error.statusCode = 403;
    throw error;
  }

  // Status check: must be in STUDENT_VERIFICATION
  if (complaint.status !== COMPLAINT_STATUSES.STUDENT_VERIFICATION) {
    const error = new Error(
      `Cannot verify complaint in '${complaint.status}' status. Only '${COMPLAINT_STATUSES.STUDENT_VERIFICATION}' complaints can be verified.`
    );
    error.statusCode = 400;
    throw error;
  }

  // Validate decision
  if (!decision || !['ACCEPT', 'REJECT'].includes(decision)) {
    const error = new Error("Invalid verification decision. Allowed values: 'ACCEPT', 'REJECT'");
    error.statusCode = 400;
    throw error;
  }

  const now = new Date();
  const trimmedVerificationNote = verificationNote?.trim() || '';

  // Find latest active resolution record to update
  const latestResolution = await ComplaintResolution.findOne({
    complaintId: complaint._id,
    verificationDecision: null,
  }).sort({ createdAt: -1 });

  if (decision === 'ACCEPT') {
    complaint.status = COMPLAINT_STATUSES.CLOSED;
    complaint.verifiedBy = verifyingUser._id;
    complaint.verifiedAt = now;
    complaint.verificationNote = trimmedVerificationNote;
    complaint.closedAt = now;

    // Complete SLA cycle upon closure
    await completeSlaForComplaint(complaint);

    if (latestResolution) {
      latestResolution.verificationDecision = 'ACCEPT';
      latestResolution.verifiedBy = verifyingUser._id;
      latestResolution.verifiedAt = now;
      latestResolution.verificationNote = trimmedVerificationNote;
      await latestResolution.save();
    }
  } else {
    // decision === 'REJECT'
    if (!reopenReason || typeof reopenReason !== 'string' || !reopenReason.trim() || reopenReason.trim().length < 5) {
      const error = new Error('A valid reason (at least 5 characters) is mandatory when reopening a complaint');
      error.statusCode = 400;
      throw error;
    }
    if (reopenReason.trim().length > 1000) {
      const error = new Error('Reopen reason cannot exceed 1000 characters');
      error.statusCode = 400;
      throw error;
    }

    const trimmedReopenReason = reopenReason.trim();

    complaint.status = COMPLAINT_STATUSES.REOPENED;
    complaint.reopenedBy = verifyingUser._id;
    complaint.reopenedAt = now;
    complaint.reopenReason = trimmedReopenReason;
    complaint.reopenCount = (complaint.reopenCount || 0) + 1;
    complaint.verifiedBy = verifyingUser._id;
    complaint.verifiedAt = now;
    complaint.verificationNote = trimmedVerificationNote;

    if (latestResolution) {
      latestResolution.verificationDecision = 'REJECT';
      latestResolution.verifiedBy = verifyingUser._id;
      latestResolution.verifiedAt = now;
      latestResolution.verificationNote = trimmedVerificationNote;
      latestResolution.reopened = true;
      latestResolution.reopenedBy = verifyingUser._id;
      latestResolution.reopenedAt = now;
      latestResolution.reopenReason = trimmedReopenReason;
      await latestResolution.save();
    }
  }

  await complaint.save();

  // Trigger verification notifications
  Promise.resolve().then(async () => {
    try {
      if (decision === 'ACCEPT') {
        if (complaint.assignedTo) {
          await createNotification({
            recipient: complaint.assignedTo,
            type: NOTIFICATION_TYPES.COMPLAINT_STATUS_CHANGED,
            title: 'Complaint Closed & Confirmed',
            message: `Student verified and accepted resolution for #${complaint.complaintId}. Ticket is officially closed.`,
            relatedEntityType: 'COMPLAINT',
            relatedEntityId: complaint._id,
            metadata: { complaintId: complaint.complaintId, status: COMPLAINT_STATUSES.CLOSED },
          });
        }
      } else {
        // decision === 'REJECT'
        if (complaint.assignedTo) {
          await createNotification({
            recipient: complaint.assignedTo,
            type: NOTIFICATION_TYPES.COMPLAINT_REOPENED,
            title: 'Complaint Reopened by Student',
            message: `Complaint #${complaint.complaintId} was reopened: "${complaint.reopenReason || 'Resolution rejected'}".`,
            relatedEntityType: 'COMPLAINT',
            relatedEntityId: complaint._id,
            metadata: { complaintId: complaint.complaintId, status: COMPLAINT_STATUSES.REOPENED },
          });
        }

        const wardens = await User.find({
          role: ROLES.WARDEN,
          hostelId: complaint.hostelId,
          isActive: true,
        }).select('_id').lean();

        if (wardens.length > 0) {
          await createBatchNotifications(
            wardens.map((w) => w._id),
            {
              type: NOTIFICATION_TYPES.COMPLAINT_REOPENED,
              title: 'Complaint Reopened in Hostel',
              message: `Complaint #${complaint.complaintId} was reopened by the resident student.`,
              relatedEntityType: 'COMPLAINT',
              relatedEntityId: complaint._id,
              metadata: { complaintId: complaint.complaintId, status: COMPLAINT_STATUSES.REOPENED },
            }
          );
        }
      }
    } catch (e) {
      console.error('[complaintService] Error dispatching verification notification:', e.message);
    }
  });

  return getComplaintById(complaint._id.toString(), verifyingUser);
};

/**
 * Resume Work on Reopened Complaint (Action: REOPENED -> IN_PROGRESS)
 * Roles: HOSTEL_STAFF (assigned staff or super admin), WARDEN, AUTHORITY, SUPER_ADMIN
 */
export const resumeWorkOnComplaint = async (idOrComplaintId, resumingUser) => {
  const complaint = await findComplaintDoc(idOrComplaintId);
  if (!complaint) {
    const error = new Error('Complaint not found');
    error.statusCode = 404;
    throw error;
  }

  // RBAC checks
  if (resumingUser.role === ROLES.STUDENT) {
    const error = new Error('Students are not authorized to resume complaint work');
    error.statusCode = 403;
    throw error;
  }

  if (resumingUser.role === ROLES.HOSTEL_STAFF) {
    const currentAssigneeId = complaint.assignedTo?._id || complaint.assignedTo;
    if (!currentAssigneeId || String(currentAssigneeId) !== String(resumingUser._id)) {
      const error = new Error('You can only resume work on complaints assigned to you');
      error.statusCode = 403;
      throw error;
    }
  } else if (resumingUser.role === ROLES.WARDEN) {
    const complaintHostelId = complaint.hostelId?._id || complaint.hostelId;
    if (resumingUser.hostelId && String(complaintHostelId) !== String(resumingUser.hostelId)) {
      const error = new Error('You can only manage complaints belonging to your assigned hostel');
      error.statusCode = 403;
      throw error;
    }
  }

  // State Transition check: must be REOPENED
  if (complaint.status !== COMPLAINT_STATUSES.REOPENED) {
    const error = new Error(
      `Cannot resume work on complaint in '${complaint.status}' status. Only '${COMPLAINT_STATUSES.REOPENED}' complaints can be resumed.`
    );
    error.statusCode = 400;
    throw error;
  }

  // Status transition to IN_PROGRESS (preserves existing assignment)
  complaint.status = COMPLAINT_STATUSES.IN_PROGRESS;
  complaint.startedAt = new Date();

  await complaint.save();

  // Start fresh SLA cycle for reopened complaint
  await startSlaForComplaint(complaint);

  return getComplaintById(complaint._id.toString(), resumingUser);
};

/**
 * Get chronological resolution and verification history for a complaint
 */
export const getComplaintResolutions = async (idOrComplaintId, requestingUser) => {
  const complaint = await findComplaintDoc(idOrComplaintId);
  if (!complaint) {
    const error = new Error('Complaint not found');
    error.statusCode = 404;
    throw error;
  }

  // Role permissions check
  if (requestingUser.role === ROLES.STUDENT) {
    const ownerId = complaint.studentId?._id || complaint.studentId;
    if (String(ownerId) !== String(requestingUser._id)) {
      const error = new Error('You are not authorized to view resolutions for this complaint');
      error.statusCode = 403;
      throw error;
    }
  } else if (requestingUser.role === ROLES.WARDEN) {
    const complaintHostelId = complaint.hostelId?._id || complaint.hostelId;
    if (requestingUser.hostelId && String(complaintHostelId) !== String(requestingUser.hostelId)) {
      const error = new Error('You are not authorized to view complaints outside your assigned hostel');
      error.statusCode = 403;
      throw error;
    }
  }

  return ComplaintResolution.find({ complaintId: complaint._id })
    .sort({ createdAt: -1 })
    .populate('resolvedBy', 'name email role employeeId')
    .populate('verifiedBy', 'name email role studentId')
    .populate('reopenedBy', 'name email role studentId')
    .lean();
};

/**
 * Get complaint count metrics for student dashboard
 */
export const getStudentComplaintMetrics = async (studentUserId) => {
  const [total, submitted, inProgress, resolved, closed, reopened, slaActive] = await Promise.all([
    Complaint.countDocuments({ studentId: studentUserId }),
    Complaint.countDocuments({ studentId: studentUserId, status: COMPLAINT_STATUSES.SUBMITTED }),
    Complaint.countDocuments({
      studentId: studentUserId,
      status: {
        $in: [
          COMPLAINT_STATUSES.TRIAGED,
          COMPLAINT_STATUSES.ASSIGNED,
          COMPLAINT_STATUSES.ACKNOWLEDGED,
          COMPLAINT_STATUSES.IN_PROGRESS,
          COMPLAINT_STATUSES.WAITING_FOR_INFORMATION,
          COMPLAINT_STATUSES.ESCALATED,
        ],
      },
    }),
    Complaint.countDocuments({
      studentId: studentUserId,
      status: {
        $in: [COMPLAINT_STATUSES.RESOLVED, COMPLAINT_STATUSES.STUDENT_VERIFICATION],
      },
    }),
    Complaint.countDocuments({ studentId: studentUserId, status: COMPLAINT_STATUSES.CLOSED }),
    Complaint.countDocuments({ studentId: studentUserId, status: COMPLAINT_STATUSES.REOPENED }),
    Complaint.countDocuments({ studentId: studentUserId, slaStatus: 'ACTIVE' }),
  ]);

  return {
    total,
    submitted,
    inProgress,
    resolved,
    closed,
    reopened,
    slaActive,
  };
};
