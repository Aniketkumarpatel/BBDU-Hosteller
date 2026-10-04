import asyncHandler from '../utils/asyncHandler.js';
import {
  getUserNotifications,
  getUnreadCount,
  markNotificationAsRead,
  markAllAsRead,
  deleteNotification,
} from '../services/notification.service.js';

/**
 * GET /api/notifications
 * Get paginated list of notifications for the authenticated user.
 */
export const getMyNotifications = asyncHandler(async (req, res) => {
  const result = await getUserNotifications(req.user._id, req.query);
  return res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * GET /api/notifications/unread-count
 * Get quick count of unread notifications for badge display.
 */
export const getMyUnreadCount = asyncHandler(async (req, res) => {
  const unreadCount = await getUnreadCount(req.user._id);
  return res.status(200).json({
    success: true,
    data: { unreadCount },
  });
});

/**
 * PATCH /api/notifications/:id/read
 * Mark a single notification as read.
 */
export const markAsRead = asyncHandler(async (req, res) => {
  const notification = await markNotificationAsRead(req.params.id, req.user._id);
  return res.status(200).json({
    success: true,
    message: 'Notification marked as read',
    data: notification,
  });
});

/**
 * PATCH /api/notifications/read-all
 * Mark all unread notifications as read.
 */
export const markAllRead = asyncHandler(async (req, res) => {
  const result = await markAllAsRead(req.user._id);
  return res.status(200).json({
    success: true,
    message: 'All notifications marked as read',
    data: result,
  });
});

/**
 * DELETE /api/notifications/:id
 * Delete a specific notification.
 */
export const removeNotification = asyncHandler(async (req, res) => {
  const result = await deleteNotification(req.params.id, req.user._id);
  return res.status(200).json({
    success: true,
    message: 'Notification deleted successfully',
    data: result,
  });
});
