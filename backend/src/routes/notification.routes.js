import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  getMyNotifications,
  getMyUnreadCount,
  markAsRead,
  markAllRead,
  removeNotification,
} from '../controllers/notification.controller.js';

const router = Router();

// All notification routes are strictly authenticated
router.use(requireAuth);

router.get('/', getMyNotifications);
router.get('/unread-count', getMyUnreadCount);
router.patch('/read-all', markAllRead);
router.patch('/:id/read', markAsRead);
router.delete('/:id', removeNotification);

export default router;
