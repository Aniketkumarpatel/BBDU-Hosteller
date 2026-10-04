import crypto from 'crypto';
import Outpass from '../models/Outpass.js';
import Visitor from '../models/Visitor.js';
import User from '../models/User.js';
import Hostel from '../models/Hostel.js';
import { getNextSequence } from '../models/Counter.js';
import {
  OUTPASS_STATUSES,
  OUTPASS_PURPOSES,
  VISITOR_STATUSES,
} from '../constants/outpass.constants.js';
import { ROLES } from '../constants/roles.js';
import { NOTIFICATION_TYPES } from '../constants/notification.constants.js';
import { createNotification } from './notification.service.js';
import ApiError from '../utils/ApiError.js';

/**
 * Generate atomic sequential Outpass ID: OUT-YYYY-XXXXX
 */
export const generateOutpassId = async () => {
  const year = new Date().getFullYear();
  const sequenceKey = `outpass_${year}`;

  let attempts = 0;
  while (attempts < 5) {
    const seq = await getNextSequence(sequenceKey);
    const outpassId = `OUT-${year}-${String(seq).padStart(5, '0')}`;
    const existing = await Outpass.findOne({ outpassId }).lean();
    if (!existing) return outpassId;
    attempts += 1;
  }
  return `OUT-${year}-${Math.floor(10000 + Math.random() * 90000)}`;
};

/**
 * Generate atomic sequential Visitor ID: VIS-YYYY-XXXXX
 */
export const generateVisitorId = async () => {
  const year = new Date().getFullYear();
  const sequenceKey = `visitor_${year}`;

  let attempts = 0;
  while (attempts < 5) {
    const seq = await getNextSequence(sequenceKey);
    const visitorId = `VIS-${year}-${String(seq).padStart(5, '0')}`;
    const existing = await Visitor.findOne({ visitorId }).lean();
    if (!existing) return visitorId;
    attempts += 1;
  }
  return `VIS-${year}-${Math.floor(10000 + Math.random() * 90000)}`;
};

/**
 * Generate cryptographically secure digital pass token for QR verification
 */
export const generatePassToken = () => {
  return crypto.randomBytes(24).toString('hex');
};

// ==========================================
// 1. STUDENT OUTPASS REQUEST & LIFECYCLE
// ==========================================

export const createOutpassRequest = async (studentId, data) => {
  const student = await User.findById(studentId);
  if (!student) throw new ApiError(404, 'Student record not found');
  if (student.role !== ROLES.STUDENT) throw new ApiError(403, 'Only students can request an outpass');
  if (!student.hostelId) throw new ApiError(400, 'Student is not allocated to an active hostel');

  if (!data.purpose || !data.destination || !data.departureAt || !data.expectedReturnAt) {
    throw new ApiError(400, 'Purpose, destination, departure time, and expected return time are required');
  }

  const departure = new Date(data.departureAt);
  const expectedReturn = new Date(data.expectedReturnAt);
  const now = new Date();

  // Departure cannot be in the past (allow 15-minute clock drift buffer)
  if (departure.getTime() < now.getTime() - 15 * 60 * 1000) {
    throw new ApiError(400, 'Departure time cannot be in the past');
  }

  if (expectedReturn.getTime() <= departure.getTime()) {
    throw new ApiError(400, 'Expected return time must be strictly after departure time');
  }

  // Prevent overlapping active outpass
  const activeExisting = await Outpass.findOne({
    studentId: student._id,
    status: {
      $in: [
        OUTPASS_STATUSES.PENDING,
        OUTPASS_STATUSES.APPROVED,
        OUTPASS_STATUSES.OUTSIDE,
        OUTPASS_STATUSES.OVERDUE,
      ],
    },
  }).lean();

  if (activeExisting) {
    throw new ApiError(
      400,
      `You already have an active or pending outpass (${activeExisting.outpassId} - ${activeExisting.status}). Complete or cancel it first.`
    );
  }

  const outpassId = await generateOutpassId();
  const isEmergency = [OUTPASS_PURPOSES.MEDICAL, OUTPASS_PURPOSES.EMERGENCY].includes(data.purpose);

  const outpass = await Outpass.create({
    outpassId,
    studentId: student._id,
    hostelId: student.hostelId,
    blockId: student.blockId || null,
    floorId: student.floorId || null,
    roomId: student.roomId || null,
    purpose: data.purpose,
    destination: data.destination.trim(),
    departureAt: departure,
    expectedReturnAt: expectedReturn,
    emergencyContact: data.emergencyContact || {
      name: '',
      phone: '',
      relation: '',
    },
    remarks: data.remarks || '',
    isEmergency,
    status: OUTPASS_STATUSES.PENDING,
    auditLog: [
      {
        action: 'REQUEST_SUBMITTED',
        performedBy: student._id,
        previousStatus: null,
        newStatus: OUTPASS_STATUSES.PENDING,
        note: `Outpass requested by ${student.name}${isEmergency ? ' (EMERGENCY PRIORITY)' : ''}`,
        timestamp: now,
      },
    ],
  });

  // Notify Wardens of this hostel
  const wardens = await User.find({
    role: { $in: [ROLES.WARDEN, ROLES.SUPER_ADMIN] },
    hostelId: student.hostelId,
    isActive: true,
  });

  for (const warden of wardens) {
    createNotification({
      recipient: warden._id,
      type: isEmergency
        ? NOTIFICATION_TYPES.OUTPASS_EMERGENCY_ALERT
        : NOTIFICATION_TYPES.OUTPASS_REQUESTED,
      title: isEmergency ? '🚨 URGENT: Emergency Outpass Request' : 'New Outpass Request Submitted',
      message: `${student.name} requested an outpass (${outpass.outpassId}) for ${outpass.purpose}: ${outpass.destination}`,
      relatedEntityType: 'OUTPASS',
      relatedEntityId: outpass._id,
      metadata: { outpassId: outpass.outpassId, isEmergency },
    }).catch(() => {});
  }

  return outpass;
};

export const getOutpasses = async (query = {}, user) => {
  const filter = {};

  if (user.role === ROLES.STUDENT) {
    // Students strictly see only their own outpasses
    filter.studentId = user._id;
  } else if (user.role === ROLES.WARDEN && user.hostelId) {
    // Wardens view outpasses for their assigned hostel
    filter.hostelId = user.hostelId;
  } else if (query.hostelId) {
    filter.hostelId = query.hostelId;
  }

  if (query.status) filter.status = query.status;
  if (query.purpose) filter.purpose = query.purpose;
  if (query.isEmergency !== undefined) filter.isEmergency = query.isEmergency === 'true' || query.isEmergency === true;
  if (query.studentId && user.role !== ROLES.STUDENT) filter.studentId = query.studentId;

  if (query.search) {
    filter.$or = [
      { outpassId: { $regex: query.search, $options: 'i' } },
      { destination: { $regex: query.search, $options: 'i' } },
    ];
  }

  return Outpass.find(filter)
    .populate('studentId', 'name email studentId phone')
    .populate('hostelId', 'name')
    .populate('blockId', 'name')
    .populate('roomId', 'roomNumber')
    .populate('approvedBy', 'name role')
    .populate('verifiedExitBy', 'name role')
    .populate('verifiedReturnBy', 'name role')
    .sort({ createdAt: -1 });
};

export const getOutpassById = async (id, user) => {
  const outpass = await Outpass.findById(id)
    .populate('studentId', 'name email studentId phone')
    .populate('hostelId', 'name')
    .populate('blockId', 'name')
    .populate('floorId', 'floorNumber')
    .populate('roomId', 'roomNumber')
    .populate('approvedBy', 'name role')
    .populate('rejectedBy', 'name role')
    .populate('verifiedExitBy', 'name role')
    .populate('verifiedReturnBy', 'name role')
    .populate('auditLog.performedBy', 'name role');

  if (!outpass) throw new ApiError(404, 'Outpass record not found');

  // Authorization check
  if (user.role === ROLES.STUDENT && String(outpass.studentId._id) !== String(user._id)) {
    throw new ApiError(403, 'You are not authorized to view this outpass');
  }

  return outpass;
};

// ==========================================
// 2. WARDEN APPROVAL / REJECTION
// ==========================================

export const approveOutpass = async (id, { remarks }, wardenUser) => {
  const outpass = await Outpass.findById(id).populate('studentId');
  if (!outpass) throw new ApiError(404, 'Outpass record not found');

  if (outpass.status !== OUTPASS_STATUSES.PENDING) {
    throw new ApiError(400, `Cannot approve outpass in '${outpass.status}' status`);
  }

  // Prevent student from approving own outpass
  if (String(outpass.studentId._id) === String(wardenUser._id)) {
    throw new ApiError(403, 'Students cannot approve their own outpass request');
  }

  // Scoped authorization for Warden
  if (
    wardenUser.role === ROLES.WARDEN &&
    wardenUser.hostelId &&
    String(wardenUser.hostelId) !== String(outpass.hostelId)
  ) {
    throw new ApiError(403, 'Wardens can only approve outpasses for their assigned hostel');
  }

  const previousStatus = outpass.status;
  const now = new Date();
  const token = generatePassToken();

  outpass.status = OUTPASS_STATUSES.APPROVED;
  outpass.approvedBy = wardenUser._id;
  outpass.approvedAt = now;
  outpass.approvalRemarks = remarks || '';
  outpass.digitalPassToken = token;

  outpass.auditLog.push({
    action: 'OUTPASS_APPROVED',
    performedBy: wardenUser._id,
    previousStatus,
    newStatus: OUTPASS_STATUSES.APPROVED,
    note: remarks || `Approved by ${wardenUser.name}`,
    timestamp: now,
  });

  await outpass.save();

  // Notify Student
  createNotification({
    recipient: outpass.studentId._id,
    type: NOTIFICATION_TYPES.OUTPASS_APPROVED,
    title: 'Outpass Approved! Digital Pass Ready',
    message: `Your outpass ${outpass.outpassId} to ${outpass.destination} has been approved. Show your digital pass at the gate.`,
    relatedEntityType: 'OUTPASS',
    relatedEntityId: outpass._id,
    metadata: { outpassId: outpass.outpassId },
  }).catch(() => {});

  return outpass;
};

export const rejectOutpass = async (id, { rejectionReason }, wardenUser) => {
  const outpass = await Outpass.findById(id).populate('studentId');
  if (!outpass) throw new ApiError(404, 'Outpass record not found');

  if (outpass.status !== OUTPASS_STATUSES.PENDING) {
    throw new ApiError(400, `Cannot reject outpass in '${outpass.status}' status`);
  }

  if (!rejectionReason || !rejectionReason.trim()) {
    throw new ApiError(400, 'Rejection reason is required');
  }

  // Scoped authorization
  if (
    wardenUser.role === ROLES.WARDEN &&
    wardenUser.hostelId &&
    String(wardenUser.hostelId) !== String(outpass.hostelId)
  ) {
    throw new ApiError(403, 'Wardens can only review outpasses for their assigned hostel');
  }

  const previousStatus = outpass.status;
  const now = new Date();

  outpass.status = OUTPASS_STATUSES.REJECTED;
  outpass.rejectedBy = wardenUser._id;
  outpass.rejectedAt = now;
  outpass.rejectionReason = rejectionReason.trim();

  outpass.auditLog.push({
    action: 'OUTPASS_REJECTED',
    performedBy: wardenUser._id,
    previousStatus,
    newStatus: OUTPASS_STATUSES.REJECTED,
    note: `Rejected: ${rejectionReason}`,
    timestamp: now,
  });

  await outpass.save();

  // Notify Student
  createNotification({
    recipient: outpass.studentId._id,
    type: NOTIFICATION_TYPES.OUTPASS_REJECTED,
    title: 'Outpass Request Rejected',
    message: `Your outpass ${outpass.outpassId} was rejected. Reason: ${rejectionReason}`,
    relatedEntityType: 'OUTPASS',
    relatedEntityId: outpass._id,
    metadata: { outpassId: outpass.outpassId, reason: rejectionReason },
  }).catch(() => {});

  return outpass;
};

export const cancelOutpass = async (id, studentUser) => {
  const outpass = await Outpass.findById(id);
  if (!outpass) throw new ApiError(404, 'Outpass record not found');

  if (studentUser.role === ROLES.STUDENT && String(outpass.studentId) !== String(studentUser._id)) {
    throw new ApiError(403, 'You can only cancel your own outpass requests');
  }

  if (![OUTPASS_STATUSES.PENDING, OUTPASS_STATUSES.APPROVED].includes(outpass.status)) {
    throw new ApiError(400, `Cannot cancel outpass once in status '${outpass.status}'`);
  }

  const previousStatus = outpass.status;
  const now = new Date();

  outpass.status = OUTPASS_STATUSES.CANCELLED;
  outpass.auditLog.push({
    action: 'OUTPASS_CANCELLED',
    performedBy: studentUser._id,
    previousStatus,
    newStatus: OUTPASS_STATUSES.CANCELLED,
    note: `Cancelled by student ${studentUser.name}`,
    timestamp: now,
  });

  await outpass.save();
  return outpass;
};

// ==========================================
// 3. GATE EXIT & RETURN VERIFICATIONS
// ==========================================

export const verifyExit = async (id, { remarks, token }, verifierUser) => {
  const outpass = await Outpass.findById(id).populate('studentId');
  if (!outpass) throw new ApiError(404, 'Outpass record not found');

  // Student cannot self-verify exit
  if (String(outpass.studentId._id) === String(verifierUser._id)) {
    throw new ApiError(403, 'Students cannot self-verify their own hostel exit');
  }

  if (outpass.status !== OUTPASS_STATUSES.APPROVED) {
    throw new ApiError(400, `Outpass must be in 'APPROVED' status for exit verification. Current: '${outpass.status}'`);
  }

  // If token is provided (from QR scan), ensure match
  if (token && outpass.digitalPassToken && token !== outpass.digitalPassToken) {
    throw new ApiError(400, 'Invalid digital pass verification token');
  }

  const previousStatus = outpass.status;
  const now = new Date();

  outpass.status = OUTPASS_STATUSES.OUTSIDE;
  outpass.actualExitAt = now;
  outpass.verifiedExitBy = verifierUser._id;
  outpass.exitRemarks = remarks || '';

  outpass.auditLog.push({
    action: 'EXIT_VERIFIED',
    performedBy: verifierUser._id,
    previousStatus,
    newStatus: OUTPASS_STATUSES.OUTSIDE,
    note: `Exit verified at gate by ${verifierUser.name} (${verifierUser.role})`,
    timestamp: now,
  });

  await outpass.save();

  // Notify student
  createNotification({
    recipient: outpass.studentId._id,
    type: NOTIFICATION_TYPES.OUTPASS_EXIT_VERIFIED,
    title: 'Hostel Exit Logged',
    message: `Your exit has been recorded at ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Please return by ${new Date(outpass.expectedReturnAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
    relatedEntityType: 'OUTPASS',
    relatedEntityId: outpass._id,
    metadata: { outpassId: outpass.outpassId },
  }).catch(() => {});

  return outpass;
};

export const verifyReturn = async (id, { remarks }, verifierUser) => {
  const outpass = await Outpass.findById(id).populate('studentId');
  if (!outpass) throw new ApiError(404, 'Outpass record not found');

  // Student cannot self-verify return
  if (String(outpass.studentId._id) === String(verifierUser._id)) {
    throw new ApiError(403, 'Students cannot self-verify their own return');
  }

  if (![OUTPASS_STATUSES.OUTSIDE, OUTPASS_STATUSES.OVERDUE].includes(outpass.status)) {
    throw new ApiError(400, `Cannot verify return for outpass in '${outpass.status}' status`);
  }

  const previousStatus = outpass.status;
  const now = new Date();

  outpass.status = OUTPASS_STATUSES.RETURN_VERIFIED;
  outpass.actualReturnAt = now;
  outpass.verifiedReturnBy = verifierUser._id;
  outpass.returnRemarks = remarks || '';

  outpass.auditLog.push({
    action: 'RETURN_VERIFIED',
    performedBy: verifierUser._id,
    previousStatus,
    newStatus: OUTPASS_STATUSES.RETURN_VERIFIED,
    note: `Return verified at gate by ${verifierUser.name} (${verifierUser.role})`,
    timestamp: now,
  });

  await outpass.save();

  // Notify student
  createNotification({
    recipient: outpass.studentId._id,
    type: NOTIFICATION_TYPES.OUTPASS_RETURN_VERIFIED,
    title: 'Hostel Return Logged',
    message: `Your return has been verified. Outpass ${outpass.outpassId} is completed.`,
    relatedEntityType: 'OUTPASS',
    relatedEntityId: outpass._id,
    metadata: { outpassId: outpass.outpassId },
  }).catch(() => {});

  return outpass;
};

// ==========================================
// 4. DIGITAL PASS DETAILS & QR TOKEN LOOKUP
// ==========================================

export const getDigitalPass = async (id, user) => {
  const outpass = await Outpass.findById(id)
    .populate('studentId', 'name studentId email phone')
    .populate('hostelId', 'name code')
    .populate('blockId', 'name code')
    .populate('roomId', 'roomNumber')
    .populate('approvedBy', 'name role');

  if (!outpass) throw new ApiError(404, 'Outpass record not found');

  if (user.role === ROLES.STUDENT && String(outpass.studentId._id) !== String(user._id)) {
    throw new ApiError(403, 'Unauthorized to view this digital pass');
  }

  return {
    outpassId: outpass.outpassId,
    studentName: outpass.studentId.name,
    studentIdNumber: outpass.studentId.studentId || 'N/A',
    hostel: outpass.hostelId.name,
    block: outpass.blockId?.name || '',
    room: outpass.roomId?.roomNumber || '',
    purpose: outpass.purpose,
    destination: outpass.destination,
    departureAt: outpass.departureAt,
    expectedReturnAt: outpass.expectedReturnAt,
    status: outpass.status,
    isEmergency: outpass.isEmergency,
    approvedBy: outpass.approvedBy?.name || '',
    approvedAt: outpass.approvedAt,
    verificationToken: outpass.digitalPassToken,
  };
};

export const verifyDigitalPassToken = async (token) => {
  if (!token) throw new ApiError(400, 'Verification token is required');

  const outpass = await Outpass.findOne({ digitalPassToken: token })
    .populate('studentId', 'name studentId phone')
    .populate('hostelId', 'name')
    .populate('blockId', 'name')
    .populate('roomId', 'roomNumber')
    .populate('approvedBy', 'name role');

  if (!outpass) throw new ApiError(404, 'Invalid or expired digital pass token');

  return {
    outpassId: outpass.outpassId,
    studentName: outpass.studentId.name,
    studentIdNumber: outpass.studentId.studentId || '',
    hostel: outpass.hostelId.name,
    block: outpass.blockId?.name || '',
    room: outpass.roomId?.roomNumber || '',
    purpose: outpass.purpose,
    destination: outpass.destination,
    departureAt: outpass.departureAt,
    expectedReturnAt: outpass.expectedReturnAt,
    status: outpass.status,
    isEmergency: outpass.isEmergency,
    approvedBy: outpass.approvedBy?.name,
    approvedAt: outpass.approvedAt,
    actualExitAt: outpass.actualExitAt,
    actualReturnAt: outpass.actualReturnAt,
  };
};

// ==========================================
// 5. CENTRAL SCHEDULER BATCH PROCESSOR
// ==========================================

/**
 * Idempotent batch worker called by central SLA scheduler loop.
 * Detects outpasses where expectedReturnAt < now and status === 'OUTSIDE'
 * Updates to 'OVERDUE' and dispatches notifications.
 */
export const processOverdueOutpasses = async (referenceTime = new Date()) => {
  const now = new Date(referenceTime);
  const results = {
    checkedCount: 0,
    overdueMarkedCount: 0,
    errors: [],
  };

  try {
    const overdueOutpasses = await Outpass.find({
      status: OUTPASS_STATUSES.OUTSIDE,
      expectedReturnAt: { $lt: now },
    }).populate('studentId');

    results.checkedCount = overdueOutpasses.length;

    for (const outpass of overdueOutpasses) {
      try {
        outpass.status = OUTPASS_STATUSES.OVERDUE;
        outpass.auditLog.push({
          action: 'MARKED_OVERDUE',
          performedBy: null,
          previousStatus: OUTPASS_STATUSES.OUTSIDE,
          newStatus: OUTPASS_STATUSES.OVERDUE,
          note: `Overdue: return deadline exceeded (${outpass.expectedReturnAt.toISOString()})`,
          timestamp: now,
        });

        // Dispatch notification once (prevent spam)
        if (!outpass.overdueNotifiedAt) {
          outpass.overdueNotifiedAt = now;

          // Notify student
          if (outpass.studentId) {
            createNotification({
              recipient: outpass.studentId._id,
              type: NOTIFICATION_TYPES.OUTPASS_OVERDUE,
              title: '⚠️ OUTPASS OVERDUE: Return Immediately',
              message: `Your outpass ${outpass.outpassId} has expired. Please report to the hostel gate immediately.`,
              relatedEntityType: 'OUTPASS',
              relatedEntityId: outpass._id,
              metadata: { outpassId: outpass.outpassId },
            }).catch(() => {});
          }

          // Notify Wardens
          const wardens = await User.find({
            role: { $in: [ROLES.WARDEN, ROLES.SUPER_ADMIN] },
            hostelId: outpass.hostelId,
            isActive: true,
          });

          for (const warden of wardens) {
            createNotification({
              recipient: warden._id,
              type: NOTIFICATION_TYPES.OUTPASS_OVERDUE,
              title: `⚠️ Overdue Student Alert: ${outpass.studentId?.name || 'Student'}`,
              message: `Student ${outpass.studentId?.name || 'Resident'} has breached their outpass return time (${outpass.outpassId}).`,
              relatedEntityType: 'OUTPASS',
              relatedEntityId: outpass._id,
              metadata: { outpassId: outpass.outpassId, studentName: outpass.studentId?.name },
            }).catch(() => {});
          }
        }

        await outpass.save();
        results.overdueMarkedCount += 1;
      } catch (err) {
        results.errors.push({ outpassId: outpass.outpassId, error: err.message });
      }
    }
  } catch (err) {
    console.error('[outpassService] Error processing overdue outpasses:', err.message);
    results.errors.push({ error: err.message });
  }

  return results;
};

// ==========================================
// 6. VISITOR MANAGEMENT
// ==========================================

export const requestVisitor = async (data, user) => {
  if (!data.visitorName || !data.phone || !data.relationship || !data.purpose) {
    throw new ApiError(400, 'Visitor name, phone, relationship, and purpose are required');
  }

  let studentId = user._id;
  let hostelId = user.hostelId;

  // If gate staff or warden registers visitor on behalf of a student
  if (user.role !== ROLES.STUDENT) {
    if (!data.studentId) throw new ApiError(400, 'Student reference is required');
    const student = await User.findById(data.studentId);
    if (!student) throw new ApiError(404, 'Referenced student not found');
    studentId = student._id;
    hostelId = student.hostelId || user.hostelId;
  }

  if (!hostelId) throw new ApiError(400, 'Hostel reference could not be determined');

  const visitorId = await generateVisitorId();

  // Privacy protection: store only last 4 digits of government ID
  let last4 = '';
  if (data.governmentIdLast4) {
    last4 = String(data.governmentIdLast4).trim().slice(-4);
  } else if (data.governmentId) {
    last4 = String(data.governmentId).trim().slice(-4);
  }

  const isStaffRegistration = user.role !== ROLES.STUDENT;
  const initialStatus = isStaffRegistration ? VISITOR_STATUSES.APPROVED : VISITOR_STATUSES.REQUESTED;

  const visitor = await Visitor.create({
    visitorId,
    visitorName: data.visitorName.trim(),
    phone: data.phone.trim(),
    governmentIdType: data.governmentIdType || 'OTHER',
    governmentIdLast4: last4,
    studentId,
    hostelId,
    relationship: data.relationship.trim(),
    purpose: data.purpose.trim(),
    visitDate: data.visitDate ? new Date(data.visitDate) : new Date(),
    expectedCheckIn: data.expectedCheckIn ? new Date(data.expectedCheckIn) : null,
    expectedCheckOut: data.expectedCheckOut ? new Date(data.expectedCheckOut) : null,
    approvedBy: isStaffRegistration ? user._id : null,
    approvedAt: isStaffRegistration ? new Date() : null,
    status: initialStatus,
    remarks: data.remarks || '',
    auditLog: [
      {
        action: 'VISITOR_REGISTERED',
        performedBy: user._id,
        previousStatus: null,
        newStatus: initialStatus,
        note: `Visitor registered by ${user.name} (${user.role})`,
        timestamp: new Date(),
      },
    ],
  });

  // Notify student or warden
  if (isStaffRegistration) {
    createNotification({
      recipient: studentId,
      type: NOTIFICATION_TYPES.VISITOR_APPROVED,
      title: 'Visitor Registered at Hostel Gate',
      message: `${visitor.visitorName} (${visitor.relationship}) has registered to visit you.`,
      relatedEntityType: 'VISITOR',
      relatedEntityId: visitor._id,
      metadata: { visitorId: visitor.visitorId },
    }).catch(() => {});
  } else {
    // Notify wardens for review
    const wardens = await User.find({
      role: { $in: [ROLES.WARDEN, ROLES.SUPER_ADMIN] },
      hostelId,
      isActive: true,
    });

    for (const warden of wardens) {
      createNotification({
        recipient: warden._id,
        type: NOTIFICATION_TYPES.VISITOR_REQUESTED,
        title: 'New Visitor Request',
        message: `Student requested visitor permission for ${visitor.visitorName} (${visitor.relationship})`,
        relatedEntityType: 'VISITOR',
        relatedEntityId: visitor._id,
        metadata: { visitorId: visitor.visitorId },
      }).catch(() => {});
    }
  }

  return visitor;
};

export const getVisitors = async (query = {}, user) => {
  const filter = {};

  if (user.role === ROLES.STUDENT) {
    filter.studentId = user._id;
  } else if (user.role === ROLES.WARDEN && user.hostelId) {
    filter.hostelId = user.hostelId;
  } else if (query.hostelId) {
    filter.hostelId = query.hostelId;
  }

  if (query.status) filter.status = query.status;
  if (query.studentId && user.role !== ROLES.STUDENT) filter.studentId = query.studentId;

  if (query.search) {
    filter.$or = [
      { visitorId: { $regex: query.search, $options: 'i' } },
      { visitorName: { $regex: query.search, $options: 'i' } },
      { phone: { $regex: query.search, $options: 'i' } },
    ];
  }

  return Visitor.find(filter)
    .populate('studentId', 'name studentId phone email')
    .populate('hostelId', 'name')
    .populate('approvedBy', 'name role')
    .populate('verifiedBy', 'name role')
    .populate('checkedOutBy', 'name role')
    .sort({ createdAt: -1 });
};

export const getVisitorById = async (id, user) => {
  const visitor = await Visitor.findById(id)
    .populate('studentId', 'name studentId phone email')
    .populate('hostelId', 'name')
    .populate('approvedBy', 'name role')
    .populate('verifiedBy', 'name role')
    .populate('checkedOutBy', 'name role')
    .populate('auditLog.performedBy', 'name role');

  if (!visitor) throw new ApiError(404, 'Visitor record not found');

  if (user.role === ROLES.STUDENT && String(visitor.studentId._id) !== String(user._id)) {
    throw new ApiError(403, 'Unauthorized to view this visitor record');
  }

  return visitor;
};

export const approveVisitor = async (id, user) => {
  const visitor = await Visitor.findById(id);
  if (!visitor) throw new ApiError(404, 'Visitor record not found');

  if (visitor.status !== VISITOR_STATUSES.REQUESTED) {
    throw new ApiError(400, `Cannot approve visitor in '${visitor.status}' status`);
  }

  const previousStatus = visitor.status;
  const now = new Date();

  visitor.status = VISITOR_STATUSES.APPROVED;
  visitor.approvedBy = user._id;
  visitor.approvedAt = now;

  visitor.auditLog.push({
    action: 'VISITOR_APPROVED',
    performedBy: user._id,
    previousStatus,
    newStatus: VISITOR_STATUSES.APPROVED,
    note: `Approved by ${user.name}`,
    timestamp: now,
  });

  await visitor.save();

  createNotification({
    recipient: visitor.studentId,
    type: NOTIFICATION_TYPES.VISITOR_APPROVED,
    title: 'Visitor Request Approved',
    message: `Your visitor ${visitor.visitorName} has been approved.`,
    relatedEntityType: 'VISITOR',
    relatedEntityId: visitor._id,
    metadata: { visitorId: visitor.visitorId },
  }).catch(() => {});

  return visitor;
};

export const checkInVisitor = async (id, { remarks }, verifierUser) => {
  const visitor = await Visitor.findById(id);
  if (!visitor) throw new ApiError(404, 'Visitor record not found');

  if (visitor.status !== VISITOR_STATUSES.APPROVED) {
    throw new ApiError(400, `Visitor must be in 'APPROVED' status before check-in. Current: '${visitor.status}'`);
  }

  const previousStatus = visitor.status;
  const now = new Date();

  visitor.status = VISITOR_STATUSES.CHECKED_IN;
  visitor.actualCheckIn = now;
  visitor.verifiedBy = verifierUser._id;
  if (remarks) visitor.remarks = remarks;

  visitor.auditLog.push({
    action: 'VISITOR_CHECKED_IN',
    performedBy: verifierUser._id,
    previousStatus,
    newStatus: VISITOR_STATUSES.CHECKED_IN,
    note: `Checked in at gate by ${verifierUser.name}`,
    timestamp: now,
  });

  await visitor.save();

  createNotification({
    recipient: visitor.studentId,
    type: NOTIFICATION_TYPES.VISITOR_CHECKED_IN,
    title: 'Visitor Checked In',
    message: `${visitor.visitorName} has arrived and checked in at the hostel gate.`,
    relatedEntityType: 'VISITOR',
    relatedEntityId: visitor._id,
    metadata: { visitorId: visitor.visitorId },
  }).catch(() => {});

  return visitor;
};

export const checkOutVisitor = async (id, { remarks }, verifierUser) => {
  const visitor = await Visitor.findById(id);
  if (!visitor) throw new ApiError(404, 'Visitor record not found');

  if (visitor.status !== VISITOR_STATUSES.CHECKED_IN) {
    throw new ApiError(400, `Visitor must be checked in before checking out. Current: '${visitor.status}'`);
  }

  const previousStatus = visitor.status;
  const now = new Date();

  visitor.status = VISITOR_STATUSES.CHECKED_OUT;
  visitor.actualCheckOut = now;
  visitor.checkedOutBy = verifierUser._id;
  if (remarks) visitor.remarks = `${visitor.remarks ? `${visitor.remarks} | ` : ''}${remarks}`;

  visitor.auditLog.push({
    action: 'VISITOR_CHECKED_OUT',
    performedBy: verifierUser._id,
    previousStatus,
    newStatus: VISITOR_STATUSES.CHECKED_OUT,
    note: `Checked out at gate by ${verifierUser.name}`,
    timestamp: now,
  });

  await visitor.save();

  createNotification({
    recipient: visitor.studentId,
    type: NOTIFICATION_TYPES.VISITOR_CHECKED_OUT,
    title: 'Visitor Checked Out',
    message: `${visitor.visitorName} has checked out of the hostel.`,
    relatedEntityType: 'VISITOR',
    relatedEntityId: visitor._id,
    metadata: { visitorId: visitor.visitorId },
  }).catch(() => {});

  return visitor;
};

export const rejectVisitor = async (id, { reason }, wardenUser) => {
  const visitor = await Visitor.findById(id);
  if (!visitor) throw new ApiError(404, 'Visitor record not found');

  if (visitor.status !== VISITOR_STATUSES.REQUESTED) {
    throw new ApiError(400, `Cannot reject visitor in '${visitor.status}' status`);
  }

  const previousStatus = visitor.status;
  const now = new Date();

  visitor.status = VISITOR_STATUSES.REJECTED;
  visitor.remarks = reason || 'Rejected by Warden';

  visitor.auditLog.push({
    action: 'VISITOR_REJECTED',
    performedBy: wardenUser._id,
    previousStatus,
    newStatus: VISITOR_STATUSES.REJECTED,
    note: `Rejected: ${reason || 'Denied'}`,
    timestamp: now,
  });

  await visitor.save();
  return visitor;
};

// ==========================================
// 7. OPERATIONAL INTELLIGENCE & KPI DASHBOARD
// ==========================================

export const getOutpassDashboardStats = async (filters = {}, user) => {
  const match = {};
  if (user.role === ROLES.WARDEN && user.hostelId) {
    match.hostelId = user.hostelId;
  } else if (filters.hostelId) {
    match.hostelId = filters.hostelId;
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const [
    currentlyOutside,
    pendingRequests,
    overdueOutpasses,
    approvedToday,
    returnsToday,
    emergencyPending,
    activeVisitors,
  ] = await Promise.all([
    Outpass.countDocuments({ ...match, status: OUTPASS_STATUSES.OUTSIDE }),
    Outpass.countDocuments({ ...match, status: OUTPASS_STATUSES.PENDING }),
    Outpass.countDocuments({ ...match, status: OUTPASS_STATUSES.OVERDUE }),
    Outpass.countDocuments({
      ...match,
      status: { $in: [OUTPASS_STATUSES.APPROVED, OUTPASS_STATUSES.OUTSIDE, OUTPASS_STATUSES.RETURN_VERIFIED] },
      approvedAt: { $gte: todayStart, $lte: todayEnd },
    }),
    Outpass.countDocuments({
      ...match,
      status: OUTPASS_STATUSES.RETURN_VERIFIED,
      actualReturnAt: { $gte: todayStart, $lte: todayEnd },
    }),
    Outpass.countDocuments({
      ...match,
      status: OUTPASS_STATUSES.PENDING,
      isEmergency: true,
    }),
    Visitor.countDocuments({ ...match, status: VISITOR_STATUSES.CHECKED_IN }),
  ]);

  return {
    currentlyOutside,
    pendingRequests,
    overdueOutpasses,
    approvedToday,
    returnsToday,
    emergencyPending,
    activeVisitors,
  };
};
