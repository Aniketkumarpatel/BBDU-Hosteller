import { Notification, User, Complaint } from '../models/index.js';
import ApiError from '../utils/ApiError.js';
import { NOTIFICATION_TYPES } from '../constants/notification.constants.js';

/**
 * Centralized Notification Service for BBDU Hosteller.
 * Manages in-app notifications dispatched across complaint lifecycle and SLA events.
 */

/**
 * Adds the room, block and title of the related complaint to a notification's metadata so
 * screens can say "Room 102, Tap leaking" instead of repeating a ticket number (DEC-030).
 * Values already set by the caller win. Never throws: a notification must still be created
 * when the lookup fails.
 */
const withComplaintContext = async (relatedEntityType, relatedEntityId, metadata) => {
  if (relatedEntityType !== 'COMPLAINT' || !relatedEntityId) return metadata;
  try {
    const complaint = await Complaint.findById(relatedEntityId)
      .select('title roomId blockId')
      .populate('roomId', 'roomNumber')
      .populate('blockId', 'name')
      .lean();
    if (!complaint) return metadata;
    const context = {};
    if (complaint.title) context.title = complaint.title;
    if (complaint.roomId?.roomNumber) context.room = String(complaint.roomId.roomNumber);
    if (complaint.blockId?.name) context.block = complaint.blockId.name;
    return { ...context, ...metadata };
  } catch (err) {
    console.error('[notificationService] Could not add complaint context:', err.message);
    return metadata;
  }
};

/**
 * Create a single in-app notification for a specific recipient.
 * Includes idempotent de-duplication to prevent duplicate notifications
 * within a 10-second threshold for the same recipient, type, and entity.
 */
export const createNotification = async ({
  recipient,
  type,
  title,
  message,
  relatedEntityType = 'COMPLAINT',
  relatedEntityId = null,
  metadata = {},
}) => {
  if (!recipient) {
    return null;
  }

  const recipientId = recipient._id || recipient;

  // Deduplication guard: ignore exact duplicate within the last 10 seconds
  if (relatedEntityId) {
    const recentDuplicate = await Notification.findOne({
      recipient: recipientId,
      type,
      relatedEntityId,
      createdAt: { $gte: new Date(Date.now() - 10000) },
    }).lean();

    if (recentDuplicate) {
      return recentDuplicate;
    }
  }

  const notification = await Notification.create({
    recipient: recipientId,
    type,
    title: title.trim(),
    message: message.trim(),
    relatedEntityType,
    relatedEntityId,
    metadata: await withComplaintContext(relatedEntityType, relatedEntityId, metadata),
    isRead: false,
    readAt: null,
  });

  return notification;
};

/**
 * Dispatch notifications to multiple recipients (e.g. all hostel wardens or team members).
 */
export const createBatchNotifications = async (recipients, notificationData) => {
  if (!Array.isArray(recipients) || recipients.length === 0) {
    return [];
  }

  // Deduplicate recipient IDs and remove falsy values
  const uniqueRecipientIds = [
    ...new Set(recipients.map((r) => String(r?._id || r)).filter(Boolean)),
  ];

  const results = await Promise.all(
    uniqueRecipientIds.map((recipientId) =>
      createNotification({
        ...notificationData,
        recipient: recipientId,
      }).catch((err) => {
        console.error(`[notificationService] Error notifying ${recipientId}:`, err.message);
        return null;
      })
    )
  );

  return results.filter(Boolean);
};

/**
 * Get paginated notifications for a specific user.
 */
export const getUserNotifications = async (
  userId,
  { page = 1, limit = 20, unreadOnly = false } = {}
) => {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const query = { recipient: userId };
  if (unreadOnly === true || unreadOnly === 'true') {
    query.isRead = false;
  }

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate('relatedEntityId', 'complaintId title status priority')
      .lean(),
    Notification.countDocuments(query),
    Notification.countDocuments({ recipient: userId, isRead: false }),
  ]);

  return {
    notifications,
    total,
    unreadCount,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum) || 1,
  };
};

/**
 * Get count of unread notifications for a user.
 */
export const getUnreadCount = async (userId) => {
  return Notification.countDocuments({ recipient: userId, isRead: false });
};

/**
 * Mark a single notification as read.
 * Validates ownership strictly to prevent cross-user mutations.
 */
export const markNotificationAsRead = async (notificationId, userId) => {
  const notification = await Notification.findById(notificationId);

  if (!notification) {
    throw new ApiError(404, 'Notification not found');
  }

  if (String(notification.recipient) !== String(userId)) {
    throw new ApiError(403, 'Forbidden: You do not have permission to access this notification');
  }

  if (!notification.isRead) {
    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();
  }

  return notification;
};

/**
 * Mark all unread notifications as read for a user.
 */
export const markAllAsRead = async (userId) => {
  const now = new Date();
  const result = await Notification.updateMany(
    { recipient: userId, isRead: false },
    { $set: { isRead: true, readAt: now } }
  );

  return {
    updatedCount: result.modifiedCount,
    markedAt: now,
  };
};

/**
 * Delete a specific notification owned by user.
 */
export const deleteNotification = async (notificationId, userId) => {
  const notification = await Notification.findById(notificationId);

  if (!notification) {
    throw new ApiError(404, 'Notification not found');
  }

  if (String(notification.recipient) !== String(userId)) {
    throw new ApiError(403, 'Forbidden: You do not have permission to delete this notification');
  }

  await Notification.findByIdAndDelete(notificationId);
  return { id: notificationId, deleted: true };
};
