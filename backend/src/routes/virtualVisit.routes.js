import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { ROLES } from '../constants/roles.js';
import {
  exploreRooms,
  getRoomVirtualVisit,
  uploadRoomMedia,
  deleteRoomMediaItem,
  updateRoomMediaMeta,
} from '../controllers/virtualVisit.controller.js';
import { handleRoomMediaUpload } from '../middleware/roomMediaUpload.js';

const router = Router();

// All virtual visit routes require an authenticated user
router.use(requireAuth);

// Read-only explore endpoint for Students, Wardens, Authorities, Staff, Admin
router.get('/explore', exploreRooms);
router.get('/rooms/:id', getRoomVirtualVisit);

// Upload/Delete/Update room media: STRICTLY restricted to WARDEN (and Super Admin)
router.post(
  '/rooms/:id/upload',
  requireRole(ROLES.WARDEN, ROLES.SUPER_ADMIN),
  handleRoomMediaUpload,
  uploadRoomMedia
);

router.delete(
  '/rooms/:id/media-item',
  requireRole(ROLES.WARDEN, ROLES.SUPER_ADMIN),
  deleteRoomMediaItem
);

router.patch(
  '/rooms/:id/media',
  requireRole(ROLES.WARDEN, ROLES.SUPER_ADMIN),
  updateRoomMediaMeta
);

export default router;
