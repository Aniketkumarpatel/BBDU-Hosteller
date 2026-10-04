import mongoose from 'mongoose';
import {
  Notice,
  ServiceRequest,
  HostelContact,
  StudentFeedback,
  User,
  Hostel,
} from '../models/index.js';
import Counter, { getNextSequence } from '../models/Counter.js';
import ApiError from '../utils/ApiError.js';
import { ROLES } from '../constants/roles.js';
import {
  NOTICE_CATEGORIES,
  NOTICE_CATEGORY_VALUES,
  NOTICE_PRIORITIES,
  NOTICE_PRIORITY_VALUES,
  NOTICE_STATUSES,
  NOTICE_STATUS_VALUES,
  NOTICE_TARGET_AUDIENCES,
  NOTICE_TARGET_AUDIENCE_VALUES,
  SERVICE_REQUEST_CATEGORIES,
  SERVICE_REQUEST_CATEGORY_VALUES,
  SERVICE_REQUEST_STATUSES,
  SERVICE_REQUEST_STATUS_VALUES,
  SERVICE_REQUEST_PRIORITIES,
  SERVICE_REQUEST_PRIORITY_VALUES,
  CONTACT_CATEGORIES,
  CONTACT_CATEGORY_VALUES,
  STUDENT_FEEDBACK_CATEGORIES,
  STUDENT_FEEDBACK_CATEGORY_VALUES,
  STUDENT_FEEDBACK_STATUSES,
  STUDENT_FEEDBACK_STATUS_VALUES,
} from '../constants/studentServices.constants.js';
import { createNotification } from './notification.service.js';
import {
  NOTIFICATION_TYPES,
  NOTIFICATION_ENTITY_TYPES,
} from '../constants/notification.constants.js';

// ============================================================================
// Sequence Generators
// ============================================================================

export const generateNoticeId = async () => {
  const year = new Date().getFullYear();
  const seq = await getNextSequence(`notice_${year}`);
  return `NOT-${year}-${String(seq).padStart(5, '0')}`;
};

export const generateServiceRequestId = async () => {
  const year = new Date().getFullYear();
  const seq = await getNextSequence(`service_request_${year}`);
  return `REQ-${year}-${String(seq).padStart(5, '0')}`;
};

export const generateContactId = async () => {
  const year = new Date().getFullYear();
  const seq = await getNextSequence(`hostel_contact_${year}`);
  return `CNT-${year}-${String(seq).padStart(5, '0')}`;
};

export const generateFeedbackId = async () => {
  const year = new Date().getFullYear();
  const seq = await getNextSequence(`student_feedback_${year}`);
  return `SFB-${year}-${String(seq).padStart(5, '0')}`;
};

// ============================================================================
// Notification Dispatch Helpers
// ============================================================================

export const dispatchNoticeNotifications = async (notice) => {
  try {
    const userQuery = { isActive: true };

    if (notice.targetAudience === NOTICE_TARGET_AUDIENCES.HOSTEL && notice.hostelId) {
      userQuery.hostelId = notice.hostelId;
    } else if (notice.targetAudience === NOTICE_TARGET_AUDIENCES.BLOCK && notice.blockId) {
      userQuery.blockId = notice.blockId;
    } else if (notice.targetAudience === NOTICE_TARGET_AUDIENCES.FLOOR && notice.floorId) {
      userQuery.floorId = notice.floorId;
    } else if (notice.targetAudience === NOTICE_TARGET_AUDIENCES.ROOM && notice.roomId) {
      userQuery.roomId = notice.roomId;
    } else if (notice.targetAudience === NOTICE_TARGET_AUDIENCES.ROLE && notice.targetRole) {
      userQuery.role = notice.targetRole;
    }

    const recipients = await User.find(userQuery).select('_id').lean();
    if (!recipients || recipients.length === 0) return 0;

    let notifType = NOTIFICATION_TYPES.NOTICE_PUBLISHED || 'NOTICE_PUBLISHED';
    if (notice.priority === NOTICE_PRIORITIES.EMERGENCY) {
      notifType = NOTIFICATION_TYPES.EMERGENCY_NOTICE || 'EMERGENCY_NOTICE';
    } else if (notice.priority === NOTICE_PRIORITIES.URGENT) {
      notifType = NOTIFICATION_TYPES.URGENT_NOTICE || 'URGENT_NOTICE';
    }

    const notifPromises = recipients.map((r) =>
      createNotification({
        recipient: r._id,
        type: notifType,
        title: `Notice: ${notice.title}`,
        message: notice.description || notice.message || 'A new notice has been published.',
        relatedEntityType: NOTIFICATION_ENTITY_TYPES.NOTICE || 'NOTICE',
        relatedEntityId: notice._id,
        metadata: {
          noticeId: notice.noticeId,
          priority: notice.priority,
          category: notice.category,
          requiresAcknowledgement: notice.requiresAcknowledgement,
        },
      }).catch((e) => console.warn(`[dispatchNoticeNotifications] Error sending to ${r._id}:`, e.message))
    );

    await Promise.allSettled(notifPromises);
    return recipients.length;
  } catch (err) {
    console.error('[dispatchNoticeNotifications] Error:', err.message);
    return 0;
  }
};

// ============================================================================
// NOTICE SERVICES
// ============================================================================

export const createNotice = async (data, user) => {
  const {
    title,
    description,
    message,
    category = NOTICE_CATEGORIES.GENERAL,
    priority = NOTICE_PRIORITIES.NORMAL,
    status = NOTICE_STATUSES.PUBLISHED,
    targetAudience = NOTICE_TARGET_AUDIENCES.ALL,
    targetRole = null,
    hostelId = null,
    blockId = null,
    floorId = null,
    roomId = null,
    publishAt = null,
    expiresAt = null,
    requiresAcknowledgement = false,
  } = data;

  if (!title || (!description && !message)) {
    throw ApiError.badRequest('Notice title and description/message are required');
  }

  // Warden scope validation
  let assignedHostelId = hostelId;
  if (user.role === ROLES.WARDEN) {
    if (!user.hostelId) {
      throw ApiError.forbidden('Warden is not assigned to any hostel');
    }
    if (hostelId && String(hostelId) !== String(user.hostelId)) {
      throw ApiError.forbidden('Warden cannot create notices for other hostels');
    }
    assignedHostelId = user.hostelId;
  }

  const generatedId = data.noticeId || (await generateNoticeId());
  const effectivePublishAt = publishAt ? new Date(publishAt) : new Date();
  const effectiveExpiresAt = expiresAt ? new Date(expiresAt) : null;

  // Determine initial status based on publishAt
  let initialStatus = status;
  const now = new Date();
  if (effectivePublishAt > now && status !== NOTICE_STATUSES.DRAFT) {
    initialStatus = NOTICE_STATUSES.DRAFT;
  }

  const notice = await Notice.create({
    noticeId: generatedId,
    title,
    description: description || message,
    message: message || description,
    category,
    priority,
    status: initialStatus,
    targetAudience,
    targetRole,
    hostelId: assignedHostelId,
    blockId,
    floorId,
    roomId,
    publishAt: effectivePublishAt,
    expiresAt: effectiveExpiresAt,
    requiresAcknowledgement: Boolean(requiresAcknowledgement),
    createdBy: user._id,
    publishedBy: initialStatus === NOTICE_STATUSES.PUBLISHED ? user._id : null,
  });

  if (notice.status === NOTICE_STATUSES.PUBLISHED) {
    await dispatchNoticeNotifications(notice);
  }

  return notice;
};

export const getNotices = async (query = {}, user) => {
  const {
    category,
    priority,
    status,
    hostelId,
    search,
    requiresAcknowledgement,
    page = 1,
    limit = 20,
    sortBy = 'publishAt',
    sortOrder = 'desc',
  } = query;

  const mongoQuery = {};

  if (user.role === ROLES.STUDENT) {
    // Students only see PUBLISHED and non-expired notices
    const now = new Date();
    mongoQuery.status = NOTICE_STATUSES.PUBLISHED;
    mongoQuery.publishAt = { $lte: now };
    mongoQuery.$and = [
      {
        $or: [
          { expiresAt: null },
          { expiresAt: { $gt: now } },
        ],
      },
      {
        $or: [
          { targetAudience: NOTICE_TARGET_AUDIENCES.ALL },
          { targetAudience: NOTICE_TARGET_AUDIENCES.ROLE, targetRole: ROLES.STUDENT },
          { hostelId: null },
          ...(user.hostelId ? [{ targetAudience: NOTICE_TARGET_AUDIENCES.HOSTEL, hostelId: user.hostelId }] : []),
          ...(user.blockId ? [{ targetAudience: NOTICE_TARGET_AUDIENCES.BLOCK, blockId: user.blockId }] : []),
          ...(user.floorId ? [{ targetAudience: NOTICE_TARGET_AUDIENCES.FLOOR, floorId: user.floorId }] : []),
          ...(user.roomId ? [{ targetAudience: NOTICE_TARGET_AUDIENCES.ROOM, roomId: user.roomId }] : []),
        ],
      },
    ];
  } else if (user.role === ROLES.WARDEN) {
    // Wardens see notices for their hostel + campus-wide notices
    if (user.hostelId) {
      mongoQuery.$or = [
        { hostelId: user.hostelId },
        { hostelId: null },
        { targetAudience: NOTICE_TARGET_AUDIENCES.ALL },
      ];
    }
    if (status) mongoQuery.status = status;
  } else {
    // Admin / Management
    if (hostelId) mongoQuery.hostelId = hostelId;
    if (status) mongoQuery.status = status;
  }

  if (category) mongoQuery.category = category;
  if (priority) mongoQuery.priority = priority;
  if (requiresAcknowledgement !== undefined) {
    mongoQuery.requiresAcknowledgement = requiresAcknowledgement === 'true' || requiresAcknowledgement === true;
  }

  if (search) {
    const sRegex = new RegExp(search.trim(), 'i');
    mongoQuery.$or = mongoQuery.$or || [];
    mongoQuery.$and = mongoQuery.$and || [];
    mongoQuery.$and.push({
      $or: [{ title: sRegex }, { description: sRegex }, { noticeId: sRegex }],
    });
  }

  const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
  const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

  const [notices, total] = await Promise.all([
    Notice.find(mongoQuery)
      .populate('createdBy', 'name email role')
      .populate('publishedBy', 'name email role')
      .populate('hostelId', 'name code')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit, 10))
      .lean(),
    Notice.countDocuments(mongoQuery),
  ]);

  // Decorate for students with acknowledgement and viewed status
  const formatted = notices.map((n) => {
    let hasAcknowledged = false;
    let hasViewed = false;
    if (user) {
      const uIdStr = String(user._id);
      if (Array.isArray(n.acknowledgements)) {
        hasAcknowledged = n.acknowledgements.some((a) => String(a.studentId) === uIdStr);
      }
      if (Array.isArray(n.views)) {
        hasViewed = n.views.some((v) => String(v.studentId) === uIdStr);
      }
    }
    return {
      ...n,
      hasAcknowledged,
      hasViewed,
      acknowledgementCount: Array.isArray(n.acknowledgements) ? n.acknowledgements.length : 0,
      viewsCount: n.viewCount || (Array.isArray(n.views) ? n.views.length : 0),
    };
  });

  return {
    notices: formatted,
    total,
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    totalPages: Math.ceil(total / parseInt(limit, 10)) || 1,
  };
};

export const getNoticeById = async (noticeId, user) => {
  const query = mongoose.isValidObjectId(noticeId)
    ? { _id: noticeId }
    : { noticeId: String(noticeId).toUpperCase() };

  const notice = await Notice.findOne(query)
    .populate('createdBy', 'name email role')
    .populate('publishedBy', 'name email role')
    .populate('hostelId', 'name code');

  if (!notice) {
    throw ApiError.notFound('Notice not found');
  }

  // Record view if user is a student and hasn't viewed yet
  if (user && user.role === ROLES.STUDENT) {
    const uIdStr = String(user._id);
    const alreadyViewed = notice.views.some((v) => String(v.studentId) === uIdStr);
    if (!alreadyViewed) {
      notice.views.push({ studentId: user._id, viewedAt: new Date() });
      notice.viewCount = (notice.viewCount || 0) + 1;
      await notice.save();
    }
  }

  const uIdStr = user ? String(user._id) : '';
  const hasAcknowledged = notice.acknowledgements.some((a) => String(a.studentId) === uIdStr);
  const hasViewed = notice.views.some((v) => String(v.studentId) === uIdStr);

  return {
    ...notice.toObject(),
    hasAcknowledged,
    hasViewed,
    acknowledgementCount: notice.acknowledgements.length,
    viewsCount: notice.viewCount || notice.views.length,
  };
};

export const acknowledgeNotice = async (noticeId, user) => {
  const query = mongoose.isValidObjectId(noticeId)
    ? { _id: noticeId }
    : { noticeId: String(noticeId).toUpperCase() };

  const notice = await Notice.findOne(query);
  if (!notice) {
    throw ApiError.notFound('Notice not found');
  }

  const uIdStr = String(user._id);
  const alreadyAcked = notice.acknowledgements.some((a) => String(a.studentId) === uIdStr);

  if (!alreadyAcked) {
    notice.acknowledgements.push({
      studentId: user._id,
      acknowledgedAt: new Date(),
    });
    // Ensure view is also recorded
    if (!notice.views.some((v) => String(v.studentId) === uIdStr)) {
      notice.views.push({ studentId: user._id, viewedAt: new Date() });
      notice.viewCount = (notice.viewCount || 0) + 1;
    }
    await notice.save();
  }

  return {
    success: true,
    message: 'Notice acknowledged successfully',
    noticeId: notice.noticeId,
    acknowledgedAt: new Date(),
    acknowledgementCount: notice.acknowledgements.length,
  };
};

export const updateNotice = async (noticeId, updateData, user) => {
  const query = mongoose.isValidObjectId(noticeId)
    ? { _id: noticeId }
    : { noticeId: String(noticeId).toUpperCase() };

  const notice = await Notice.findOne(query);
  if (!notice) {
    throw ApiError.notFound('Notice not found');
  }

  // Authority check
  if (user.role === ROLES.WARDEN && notice.hostelId && String(notice.hostelId) !== String(user.hostelId)) {
    throw ApiError.forbidden('Cannot update notice for another hostel');
  }

  const allowedUpdates = [
    'title',
    'description',
    'message',
    'category',
    'priority',
    'status',
    'targetAudience',
    'targetRole',
    'publishAt',
    'expiresAt',
    'requiresAcknowledgement',
    'isActive',
  ];

  for (const field of allowedUpdates) {
    if (updateData[field] !== undefined) {
      notice[field] = updateData[field];
    }
  }

  if (updateData.status === NOTICE_STATUSES.PUBLISHED && !notice.publishedBy) {
    notice.publishedBy = user._id;
  }

  await notice.save();
  return notice;
};

export const publishNotice = async (noticeId, user) => {
  const query = mongoose.isValidObjectId(noticeId)
    ? { _id: noticeId }
    : { noticeId: String(noticeId).toUpperCase() };

  const notice = await Notice.findOne(query);
  if (!notice) {
    throw ApiError.notFound('Notice not found');
  }

  if (notice.status === NOTICE_STATUSES.PUBLISHED) {
    return notice;
  }

  notice.status = NOTICE_STATUSES.PUBLISHED;
  notice.publishedBy = user._id;
  notice.publishAt = new Date();
  await notice.save();

  await dispatchNoticeNotifications(notice);
  return notice;
};

export const deleteOrArchiveNotice = async (noticeId, user) => {
  const query = mongoose.isValidObjectId(noticeId)
    ? { _id: noticeId }
    : { noticeId: String(noticeId).toUpperCase() };

  const notice = await Notice.findOne(query);
  if (!notice) {
    throw ApiError.notFound('Notice not found');
  }

  if (user.role === ROLES.WARDEN && notice.hostelId && String(notice.hostelId) !== String(user.hostelId)) {
    throw ApiError.forbidden('Cannot delete notice for another hostel');
  }

  notice.status = NOTICE_STATUSES.ARCHIVED;
  notice.isActive = false;
  await notice.save();

  return { success: true, message: 'Notice archived successfully' };
};

// ============================================================================
// SERVICE REQUEST SERVICES
// ============================================================================

export const createServiceRequest = async (data, user) => {
  const {
    category,
    title,
    description,
    priority = SERVICE_REQUEST_PRIORITIES.NORMAL,
    departmentId = null,
  } = data;

  if (!category || !title || !description) {
    throw ApiError.badRequest('Category, title, and description are required');
  }

  // Cross-hostel tampering prevention for students
  if (user.role === ROLES.STUDENT && user.hostelId && data.hostelId && String(data.hostelId) !== String(user.hostelId)) {
    throw ApiError.forbidden('Students cannot submit service requests for a different hostel');
  }

  const hostelId = (user.role === ROLES.STUDENT && user.hostelId) ? user.hostelId : (data.hostelId || user.hostelId);

  if (!hostelId) {
    throw ApiError.badRequest('Hostel reference is required. Please provide hostelId or ensure student is assigned to a hostel.');
  }

  const blockId = (user.role === ROLES.STUDENT && user.blockId) ? user.blockId : (data.blockId || user.blockId);
  const floorId = (user.role === ROLES.STUDENT && user.floorId) ? user.floorId : (data.floorId || user.floorId);
  const roomId = (user.role === ROLES.STUDENT && user.roomId) ? user.roomId : (data.roomId || user.roomId);

  const generatedId = data.requestId || (await generateServiceRequestId());

  const serviceRequest = await ServiceRequest.create({
    requestId: generatedId,
    studentId: user._id,
    hostelId,
    blockId,
    floorId,
    roomId,
    departmentId,
    category,
    title,
    description,
    priority,
    status: SERVICE_REQUEST_STATUSES.SUBMITTED,
    submittedAt: new Date(),
    timeline: [
      {
        action: 'SUBMITTED',
        performedBy: user._id,
        previousStatus: null,
        newStatus: SERVICE_REQUEST_STATUSES.SUBMITTED,
        notes: 'Service request submitted by student',
        timestamp: new Date(),
      },
    ],
    createdBy: user._id,
  });

  // Notify hostel wardens and authorities
  try {
    const wardens = await User.find({
      role: { $in: [ROLES.WARDEN, ROLES.SUPER_ADMIN] },
      isActive: true,
      $or: [{ hostelId }, { hostelId: null }],
    }).select('_id');

    for (const w of wardens) {
      await createNotification({
        recipient: w._id,
        type: NOTIFICATION_TYPES.SERVICE_REQUEST_SUBMITTED || 'SERVICE_REQUEST_SUBMITTED',
        title: `New Service Request: ${title}`,
        message: `Student submitted request ${serviceRequest.requestId} (${category})`,
        relatedEntityType: NOTIFICATION_ENTITY_TYPES.SERVICE_REQUEST || 'SERVICE_REQUEST',
        relatedEntityId: serviceRequest._id,
        metadata: {
          requestId: serviceRequest.requestId,
          category,
          priority,
          studentId: user._id,
        },
      }).catch(() => {});
    }
  } catch (e) {
    console.warn('[createServiceRequest] Error sending warden notifications:', e.message);
  }

  return serviceRequest;
};

export const getServiceRequests = async (query = {}, user) => {
  const {
    category,
    status,
    priority,
    hostelId,
    studentId,
    assignedTo,
    search,
    page = 1,
    limit = 20,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = query;

  const mongoQuery = {};

  if (user.role === ROLES.STUDENT) {
    mongoQuery.studentId = user._id;
  } else if (user.role === ROLES.WARDEN || user.role === ROLES.HOSTEL_STAFF) {
    if (user.hostelId) {
      mongoQuery.hostelId = user.hostelId;
    }
    if (studentId) mongoQuery.studentId = studentId;
  } else {
    // Admin / Management
    if (hostelId) mongoQuery.hostelId = hostelId;
    if (studentId) mongoQuery.studentId = studentId;
  }

  if (category) mongoQuery.category = category;
  if (status) mongoQuery.status = status;
  if (priority) mongoQuery.priority = priority;
  if (assignedTo) mongoQuery.assignedTo = assignedTo;

  if (search) {
    const sRegex = new RegExp(search.trim(), 'i');
    mongoQuery.$or = [{ title: sRegex }, { description: sRegex }, { requestId: sRegex }];
  }

  const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
  const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

  const [requests, total] = await Promise.all([
    ServiceRequest.find(mongoQuery)
      .populate('studentId', 'name email phone studentId')
      .populate('assignedTo', 'name email role employeeId')
      .populate('hostelId', 'name code')
      .populate('blockId', 'name')
      .populate('floorId', 'floorNumber')
      .populate('roomId', 'roomNumber')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit, 10))
      .lean(),
    ServiceRequest.countDocuments(mongoQuery),
  ]);

  return {
    requests,
    total,
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    totalPages: Math.ceil(total / parseInt(limit, 10)) || 1,
  };
};

export const getServiceRequestById = async (requestId, user) => {
  const query = mongoose.isValidObjectId(requestId)
    ? { _id: requestId }
    : { requestId: String(requestId).toUpperCase() };

  const request = await ServiceRequest.findOne(query)
    .populate('studentId', 'name email phone studentId')
    .populate('assignedTo', 'name email role employeeId')
    .populate('hostelId', 'name code')
    .populate('blockId', 'name')
    .populate('floorId', 'floorNumber')
    .populate('roomId', 'roomNumber')
    .populate('departmentId', 'name code')
    .populate('timeline.performedBy', 'name role email');

  if (!request) {
    throw ApiError.notFound('Service request not found');
  }

  if (user.role === ROLES.STUDENT && String(request.studentId._id || request.studentId) !== String(user._id)) {
    throw ApiError.forbidden('You do not have permission to view this request');
  }

  return request;
};

export const assignServiceRequest = async (requestId, { assignedTo, notes = '' }, user) => {
  const query = mongoose.isValidObjectId(requestId)
    ? { _id: requestId }
    : { requestId: String(requestId).toUpperCase() };

  const request = await ServiceRequest.findOne(query);
  if (!request) {
    throw ApiError.notFound('Service request not found');
  }

  const assignee = await User.findById(assignedTo);
  if (!assignee) {
    throw ApiError.notFound('Assigned staff user not found');
  }

  const prevStatus = request.status;
  request.assignedTo = assignee._id;
  request.status = SERVICE_REQUEST_STATUSES.ASSIGNED;
  request.updatedBy = user._id;

  request.timeline.push({
    action: 'ASSIGNED',
    performedBy: user._id,
    previousStatus: prevStatus,
    newStatus: SERVICE_REQUEST_STATUSES.ASSIGNED,
    notes: notes || `Assigned to ${assignee.name} (${assignee.role})`,
    timestamp: new Date(),
  });

  await request.save();

  // Notify assignee
  await createNotification({
    recipient: assignee._id,
    type: NOTIFICATION_TYPES.SERVICE_REQUEST_ASSIGNED || 'SERVICE_REQUEST_ASSIGNED',
    title: `Assigned: Service Request ${request.requestId}`,
    message: `You have been assigned service request ${request.requestId}: ${request.title}`,
    relatedEntityType: NOTIFICATION_ENTITY_TYPES.SERVICE_REQUEST || 'SERVICE_REQUEST',
    relatedEntityId: request._id,
    metadata: { requestId: request.requestId, category: request.category },
  }).catch(() => {});

  // Notify student
  await createNotification({
    recipient: request.studentId,
    type: NOTIFICATION_TYPES.SERVICE_REQUEST_ASSIGNED || 'SERVICE_REQUEST_ASSIGNED',
    title: `Update on ${request.requestId}`,
    message: `Your service request has been assigned to staff member ${assignee.name}.`,
    relatedEntityType: NOTIFICATION_ENTITY_TYPES.SERVICE_REQUEST || 'SERVICE_REQUEST',
    relatedEntityId: request._id,
    metadata: { requestId: request.requestId },
  }).catch(() => {});

  return request;
};

export const updateServiceRequestStatus = async (
  requestId,
  { status, notes = '', resolutionNote = '', rejectionReason = '', actionRequiredNote = '' },
  user
) => {
  const query = mongoose.isValidObjectId(requestId)
    ? { _id: requestId }
    : { requestId: String(requestId).toUpperCase() };

  const request = await ServiceRequest.findOne(query);
  if (!request) {
    throw ApiError.notFound('Service request not found');
  }

  if (user.role === ROLES.STUDENT) {
    // Students can only cancel their own submitted request
    if (String(request.studentId) !== String(user._id)) {
      throw ApiError.forbidden('You do not have permission to modify this request');
    }
    if (status !== SERVICE_REQUEST_STATUSES.CANCELLED) {
      throw ApiError.forbidden('Students can only cancel their service request');
    }
    if (![SERVICE_REQUEST_STATUSES.SUBMITTED, SERVICE_REQUEST_STATUSES.UNDER_REVIEW].includes(request.status)) {
      throw ApiError.badRequest('Cannot cancel request once it is assigned or in progress');
    }
  }

  const prevStatus = request.status;
  request.status = status;
  request.updatedBy = user._id;

  if (status === SERVICE_REQUEST_STATUSES.RESOLVED) {
    request.resolvedAt = new Date();
    request.resolutionNote = resolutionNote || notes;
  } else if (status === SERVICE_REQUEST_STATUSES.REJECTED) {
    request.rejectionReason = rejectionReason || notes;
  } else if (status === SERVICE_REQUEST_STATUSES.ACTION_REQUIRED) {
    request.actionRequiredNote = actionRequiredNote || notes;
  } else if (status === SERVICE_REQUEST_STATUSES.CLOSED) {
    request.closedAt = new Date();
  }

  request.timeline.push({
    action: `STATUS_CHANGED_TO_${status}`,
    performedBy: user._id,
    previousStatus: prevStatus,
    newStatus: status,
    notes: resolutionNote || rejectionReason || actionRequiredNote || notes || `Status updated to ${status}`,
    timestamp: new Date(),
  });

  await request.save();

  // Dispatch student notifications on key status changes
  if (status === SERVICE_REQUEST_STATUSES.RESOLVED) {
    await createNotification({
      recipient: request.studentId,
      type: NOTIFICATION_TYPES.SERVICE_REQUEST_RESOLVED || 'SERVICE_REQUEST_RESOLVED',
      title: `Service Request Resolved: ${request.requestId}`,
      message: `Your request has been resolved: ${request.resolutionNote || 'Please verify resolution.'}`,
      relatedEntityType: NOTIFICATION_ENTITY_TYPES.SERVICE_REQUEST || 'SERVICE_REQUEST',
      relatedEntityId: request._id,
      metadata: { requestId: request.requestId },
    }).catch(() => {});
  } else if (status === SERVICE_REQUEST_STATUSES.REJECTED) {
    await createNotification({
      recipient: request.studentId,
      type: NOTIFICATION_TYPES.SERVICE_REQUEST_REJECTED || 'SERVICE_REQUEST_REJECTED',
      title: `Service Request Rejected: ${request.requestId}`,
      message: `Your request was rejected. Reason: ${request.rejectionReason || 'Contact hostel office.'}`,
      relatedEntityType: NOTIFICATION_ENTITY_TYPES.SERVICE_REQUEST || 'SERVICE_REQUEST',
      relatedEntityId: request._id,
      metadata: { requestId: request.requestId },
    }).catch(() => {});
  }

  return request;
};

export const verifyServiceRequest = async (requestId, { isSatisfied, feedback = '' }, user) => {
  const query = mongoose.isValidObjectId(requestId)
    ? { _id: requestId }
    : { requestId: String(requestId).toUpperCase() };

  const request = await ServiceRequest.findOne(query);
  if (!request) {
    throw ApiError.notFound('Service request not found');
  }

  if (String(request.studentId) !== String(user._id)) {
    throw ApiError.forbidden('Only the requesting student can verify the service request');
  }

  if (request.status !== SERVICE_REQUEST_STATUSES.RESOLVED) {
    throw ApiError.badRequest('Can only verify service requests that are currently in RESOLVED status');
  }

  const prevStatus = request.status;
  const now = new Date();

  request.studentVerification = {
    isSatisfied: Boolean(isSatisfied),
    feedback: feedback || '',
    verifiedAt: now,
  };

  if (isSatisfied) {
    request.status = SERVICE_REQUEST_STATUSES.CLOSED;
    request.closedAt = now;
    request.timeline.push({
      action: 'STUDENT_VERIFIED_SATISFIED',
      performedBy: user._id,
      previousStatus: prevStatus,
      newStatus: SERVICE_REQUEST_STATUSES.CLOSED,
      notes: feedback ? `Student satisfied: ${feedback}` : 'Student confirmed satisfaction. Request closed.',
      timestamp: now,
    });
  } else {
    // Reopen to IN_PROGRESS for rework
    request.status = SERVICE_REQUEST_STATUSES.IN_PROGRESS;
    request.timeline.push({
      action: 'STUDENT_VERIFIED_UNSATISFIED',
      performedBy: user._id,
      previousStatus: prevStatus,
      newStatus: SERVICE_REQUEST_STATUSES.IN_PROGRESS,
      notes: feedback ? `Student reported issue: ${feedback}` : 'Student indicated unsatisfied. Reopened for rework.',
      timestamp: now,
    });

    if (request.assignedTo) {
      await createNotification({
        recipient: request.assignedTo,
        type: NOTIFICATION_TYPES.SERVICE_REQUEST_ASSIGNED || 'SERVICE_REQUEST_ASSIGNED',
        title: `Reopened Request: ${request.requestId}`,
        message: `Student was not satisfied with resolution: ${feedback || 'Please follow up.'}`,
        relatedEntityType: NOTIFICATION_ENTITY_TYPES.SERVICE_REQUEST || 'SERVICE_REQUEST',
        relatedEntityId: request._id,
        metadata: { requestId: request.requestId },
      }).catch(() => {});
    }
  }

  await request.save();
  return request;
};

// ============================================================================
// HOSTEL CONTACT DIRECTORY SERVICES
// ============================================================================

export const createHostelContact = async (data, user) => {
  const {
    hostelId = null,
    title,
    category = CONTACT_CATEGORIES.ADMINISTRATION,
    contactPerson = '',
    phoneNumber,
    altPhoneNumber = '',
    email = '',
    availableHours = '24x7',
    location = 'Main Office',
    isEmergency = false,
  } = data;

  if (!title || !phoneNumber) {
    throw ApiError.badRequest('Contact title and phone number are required');
  }

  let assignedHostelId = hostelId;
  if (user.role === ROLES.WARDEN) {
    if (!user.hostelId) {
      throw ApiError.forbidden('Warden is not assigned to any hostel');
    }
    if (hostelId && String(hostelId) !== String(user.hostelId)) {
      throw ApiError.forbidden('Warden cannot create contacts for another hostel');
    }
    assignedHostelId = user.hostelId;
  }

  const generatedId = data.contactId || (await generateContactId());

  const contact = await HostelContact.create({
    contactId: generatedId,
    hostelId: assignedHostelId,
    title,
    category,
    contactPerson,
    phoneNumber,
    altPhoneNumber,
    email,
    availableHours,
    location,
    isEmergency: Boolean(isEmergency),
    createdBy: user._id,
  });

  return contact;
};

export const getHostelContacts = async (query = {}, user) => {
  const { category, isEmergency, hostelId, search } = query;

  const mongoQuery = { isActive: true };

  // For students and wardens, return contacts for their hostel + campus-wide contacts
  const targetHostelId = hostelId || (user && user.hostelId);
  if (targetHostelId) {
    mongoQuery.$or = [{ hostelId: targetHostelId }, { hostelId: null }];
  }

  if (category) mongoQuery.category = category;
  if (isEmergency !== undefined) {
    mongoQuery.isEmergency = isEmergency === 'true' || isEmergency === true;
  }

  if (search) {
    const sRegex = new RegExp(search.trim(), 'i');
    mongoQuery.$and = mongoQuery.$and || [];
    mongoQuery.$and.push({
      $or: [
        { title: sRegex },
        { contactPerson: sRegex },
        { phoneNumber: sRegex },
        { location: sRegex },
      ],
    });
  }

  const contacts = await HostelContact.find(mongoQuery)
    .populate('hostelId', 'name code')
    .sort({ isEmergency: -1, category: 1, title: 1 })
    .lean();

  return contacts;
};

export const updateHostelContact = async (contactId, data, user) => {
  const query = mongoose.isValidObjectId(contactId)
    ? { _id: contactId }
    : { contactId: String(contactId).toUpperCase() };

  const contact = await HostelContact.findOne(query);
  if (!contact) {
    throw ApiError.notFound('Contact not found');
  }

  if (user.role === ROLES.WARDEN && contact.hostelId && String(contact.hostelId) !== String(user.hostelId)) {
    throw ApiError.forbidden('Cannot modify contacts of another hostel');
  }

  const allowed = [
    'title',
    'category',
    'contactPerson',
    'phoneNumber',
    'altPhoneNumber',
    'email',
    'availableHours',
    'location',
    'isEmergency',
    'isActive',
  ];

  for (const field of allowed) {
    if (data[field] !== undefined) {
      contact[field] = data[field];
    }
  }

  await contact.save();
  return contact;
};

export const deleteHostelContact = async (contactId, user) => {
  const query = mongoose.isValidObjectId(contactId)
    ? { _id: contactId }
    : { contactId: String(contactId).toUpperCase() };

  const contact = await HostelContact.findOne(query);
  if (!contact) {
    throw ApiError.notFound('Contact not found');
  }

  if (user.role === ROLES.WARDEN && contact.hostelId && String(contact.hostelId) !== String(user.hostelId)) {
    throw ApiError.forbidden('Cannot delete contact of another hostel');
  }

  contact.isActive = false;
  await contact.save();

  return { success: true, message: 'Contact marked inactive' };
};

// ============================================================================
// STUDENT FEEDBACK SERVICES
// ============================================================================

export const submitStudentFeedback = async (data, user) => {
  const {
    hostelId = user.hostelId,
    category = STUDENT_FEEDBACK_CATEGORIES.GENERAL || STUDENT_FEEDBACK_CATEGORIES.HOSTEL,
    rating,
    title,
    comment,
    serviceRequestId = null,
    isAnonymous = false,
  } = data;

  if (!rating || !title || !comment) {
    throw ApiError.badRequest('Rating, title, and comment are required');
  }

  if (!hostelId) {
    throw ApiError.badRequest('Hostel reference is required');
  }

  const generatedId = data.feedbackId || (await generateFeedbackId());

  const feedback = await StudentFeedback.create({
    feedbackId: generatedId,
    studentId: user._id,
    hostelId,
    category,
    rating: Number(rating),
    title,
    comment,
    serviceRequestId,
    isAnonymous: Boolean(isAnonymous),
    status: STUDENT_FEEDBACK_STATUSES.SUBMITTED,
  });

  // Notify wardens
  try {
    const wardens = await User.find({
      role: { $in: [ROLES.WARDEN, ROLES.SUPER_ADMIN] },
      isActive: true,
      $or: [{ hostelId }, { hostelId: null }],
    }).select('_id');

    for (const w of wardens) {
      await createNotification({
        recipient: w._id,
        type: NOTIFICATION_TYPES.STUDENT_FEEDBACK_RECEIVED || 'STUDENT_FEEDBACK_RECEIVED',
        title: `Student Feedback: ${title}`,
        message: `Rating ${rating}/5 received for category ${category}`,
        relatedEntityType: NOTIFICATION_ENTITY_TYPES.FEEDBACK || 'FEEDBACK',
        relatedEntityId: feedback._id,
        metadata: { feedbackId: feedback.feedbackId, rating, category },
      }).catch(() => {});
    }
  } catch (e) {
    console.warn('[submitStudentFeedback] Error notifying wardens:', e.message);
  }

  return feedback;
};

export const getStudentFeedback = async (query = {}, user) => {
  const {
    category,
    status,
    rating,
    hostelId,
    page = 1,
    limit = 20,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = query;

  const mongoQuery = {};

  if (user.role === ROLES.STUDENT) {
    mongoQuery.studentId = user._id;
  } else if (user.role === ROLES.WARDEN) {
    if (user.hostelId) {
      mongoQuery.hostelId = user.hostelId;
    }
  } else {
    if (hostelId) mongoQuery.hostelId = hostelId;
  }

  if (category) mongoQuery.category = category;
  if (status) mongoQuery.status = status;
  if (rating) mongoQuery.rating = Number(rating);

  const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
  const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

  const [feedbacks, total] = await Promise.all([
    StudentFeedback.find(mongoQuery)
      .populate('studentId', 'name studentId email')
      .populate('hostelId', 'name code')
      .populate('respondedBy', 'name role email')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit, 10))
      .lean(),
    StudentFeedback.countDocuments(mongoQuery),
  ]);

  // Mask student details if anonymous
  const maskedFeedbacks = feedbacks.map((f) => {
    if (f.isAnonymous && user.role !== ROLES.SUPER_ADMIN && String(f.studentId?._id || f.studentId) !== String(user._id)) {
      return {
        ...f,
        studentId: { name: 'Anonymous Student' },
      };
    }
    return f;
  });

  return {
    feedbacks: maskedFeedbacks,
    total,
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    totalPages: Math.ceil(total / parseInt(limit, 10)) || 1,
  };
};

export const respondToStudentFeedback = async (feedbackId, { responseNote, status }, user) => {
  if (!responseNote) {
    throw ApiError.badRequest('Response note is required');
  }

  const query = mongoose.isValidObjectId(feedbackId)
    ? { _id: feedbackId }
    : { feedbackId: String(feedbackId).toUpperCase() };

  const feedback = await StudentFeedback.findOne(query);
  if (!feedback) {
    throw ApiError.notFound('Student feedback not found');
  }

  if (user.role === ROLES.WARDEN && feedback.hostelId && String(feedback.hostelId) !== String(user.hostelId)) {
    throw ApiError.forbidden('Cannot respond to feedback for another hostel');
  }

  feedback.responseNote = responseNote;
  feedback.respondedBy = user._id;
  feedback.respondedAt = new Date();
  feedback.status = status || STUDENT_FEEDBACK_STATUSES.ACKNOWLEDGED;

  await feedback.save();

  // Notify student
  await createNotification({
    recipient: feedback.studentId,
    type: NOTIFICATION_TYPES.STUDENT_FEEDBACK_RECEIVED || 'STUDENT_FEEDBACK_RECEIVED',
    title: 'Response to Your Feedback',
    message: `Administration responded to your feedback: ${responseNote.substring(0, 100)}...`,
    relatedEntityType: NOTIFICATION_ENTITY_TYPES.FEEDBACK || 'FEEDBACK',
    relatedEntityId: feedback._id,
    metadata: { feedbackId: feedback.feedbackId },
  }).catch(() => {});

  return feedback;
};

// ============================================================================
// STATS & DASHBOARD OVERVIEW
// ============================================================================

export const getStudentServicesStats = async (hostelId = null, user) => {
  const targetHostel = hostelId || (user && user.hostelId);
  const now = new Date();

  // 1. Notice stats
  const noticeQuery = {
    status: NOTICE_STATUSES.PUBLISHED,
    publishAt: { $lte: now },
    $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
  };
  if (targetHostel) {
    noticeQuery.$and = [
      {
        $or: [
          { hostelId: targetHostel },
          { hostelId: null },
          { targetAudience: NOTICE_TARGET_AUDIENCES.ALL },
        ],
      },
    ];
  }

  const activeNotices = await Notice.find(noticeQuery).lean();
  const urgentNoticesCount = activeNotices.filter((n) =>
    [NOTICE_PRIORITIES.URGENT, NOTICE_PRIORITIES.EMERGENCY].includes(n.priority)
  ).length;

  let studentUnacknowledgedCount = 0;
  if (user && user.role === ROLES.STUDENT) {
    const uIdStr = String(user._id);
    studentUnacknowledgedCount = activeNotices.filter(
      (n) => n.requiresAcknowledgement && !n.acknowledgements?.some((a) => String(a.studentId) === uIdStr)
    ).length;
  }

  // 2. Service Requests stats
  const reqQuery = {};
  if (user && user.role === ROLES.STUDENT) {
    reqQuery.studentId = user._id;
  } else if (targetHostel) {
    reqQuery.hostelId = targetHostel;
  }

  const [totalRequests, submittedRequests, inProgressRequests, resolvedRequests, closedRequests] =
    await Promise.all([
      ServiceRequest.countDocuments(reqQuery),
      ServiceRequest.countDocuments({ ...reqQuery, status: SERVICE_REQUEST_STATUSES.SUBMITTED }),
      ServiceRequest.countDocuments({
        ...reqQuery,
        status: { $in: [SERVICE_REQUEST_STATUSES.ASSIGNED, SERVICE_REQUEST_STATUSES.IN_PROGRESS] },
      }),
      ServiceRequest.countDocuments({ ...reqQuery, status: SERVICE_REQUEST_STATUSES.RESOLVED }),
      ServiceRequest.countDocuments({ ...reqQuery, status: SERVICE_REQUEST_STATUSES.CLOSED }),
    ]);

  // 3. Emergency Contacts
  const contactQuery = { isActive: true, isEmergency: true };
  if (targetHostel) {
    contactQuery.$or = [{ hostelId: targetHostel }, { hostelId: null }];
  }
  const emergencyContactsCount = await HostelContact.countDocuments(contactQuery);

  // 4. Feedback stats
  const fbQuery = {};
  if (targetHostel) fbQuery.hostelId = targetHostel;
  const feedbackAgg = await StudentFeedback.aggregate([
    { $match: fbQuery },
    { $group: { _id: null, avgRating: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);

  const avgRating = feedbackAgg.length > 0 ? Number(feedbackAgg[0].avgRating.toFixed(1)) : 0;
  const feedbackCount = feedbackAgg.length > 0 ? feedbackAgg[0].count : 0;

  return {
    notices: {
      activeCount: activeNotices.length,
      urgentCount: urgentNoticesCount,
      unacknowledgedCount: studentUnacknowledgedCount,
    },
    serviceRequests: {
      total: totalRequests,
      submitted: submittedRequests,
      inProgress: inProgressRequests,
      resolved: resolvedRequests,
      closed: closedRequests,
    },
    emergencyContactsCount,
    feedback: {
      averageRating: avgRating,
      totalCount: feedbackCount,
    },
  };
};

// ============================================================================
// CENTRAL SCHEDULER LIFECYCLE JOB (Invoked by sla.service.js)
// ============================================================================

export const processStudentServicesLifecycleJobs = async (now = new Date()) => {
  const results = {
    publishedNoticesCount: 0,
    expiredNoticesCount: 0,
    errors: [],
  };

  // 1. Auto-publish scheduled DRAFT notices whose publishAt <= now
  try {
    const scheduledNotices = await Notice.find({
      status: NOTICE_STATUSES.DRAFT,
      publishAt: { $lte: now },
    });

    for (const notice of scheduledNotices) {
      notice.status = NOTICE_STATUSES.PUBLISHED;
      notice.publishedBy = notice.publishedBy || notice.createdBy;
      await notice.save();
      results.publishedNoticesCount += 1;

      await dispatchNoticeNotifications(notice);
    }
  } catch (err) {
    console.error('[processStudentServicesLifecycleJobs] Publish error:', err.message);
    results.errors.push({ job: 'publish_notices', error: err.message });
  }

  // 2. Auto-expire active notices whose expiresAt <= now
  try {
    const expireRes = await Notice.updateMany(
      {
        status: NOTICE_STATUSES.PUBLISHED,
        expiresAt: { $lte: now, $ne: null },
      },
      {
        $set: { status: NOTICE_STATUSES.EXPIRED, isActive: false },
      }
    );
    results.expiredNoticesCount = expireRes.modifiedCount || 0;
  } catch (err) {
    console.error('[processStudentServicesLifecycleJobs] Expiry error:', err.message);
    results.errors.push({ job: 'expire_notices', error: err.message });
  }

  return results;
};
