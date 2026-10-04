import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { ROLES } from '../constants/roles.js';
import asyncHandler from '../utils/asyncHandler.js';
import User from '../models/User.js';
import Hostel from '../models/Hostel.js';
import Block from '../models/Block.js';
import Floor from '../models/Floor.js';
import Room from '../models/Room.js';
import Department from '../models/Department.js';

import * as userCtrl from '../controllers/adminUser.controller.js';
import * as hostelCtrl from '../controllers/adminHostel.controller.js';
import * as blockCtrl from '../controllers/adminBlock.controller.js';
import * as floorCtrl from '../controllers/adminFloor.controller.js';
import * as roomCtrl from '../controllers/adminRoom.controller.js';
import * as deptCtrl from '../controllers/adminDepartment.controller.js';
import * as securityAuditCtrl from '../controllers/securityAudit.controller.js';

const router = Router();

// All administrative endpoints require SUPER_ADMIN
router.use(requireAuth, requireRole(ROLES.SUPER_ADMIN));

/**
 * System Overview Stats
 */
router.get(
  '/overview',
  asyncHandler(async (_req, res) => {
    const [userCount, hostelCount, blockCount, floorCount, roomCount, deptCount] =
      await Promise.all([
        User.countDocuments(),
        Hostel.countDocuments(),
        Block.countDocuments(),
        Floor.countDocuments(),
        Room.countDocuments(),
        Department.countDocuments(),
      ]);

    res.status(200).json({
      success: true,
      data: {
        users: userCount,
        hostels: hostelCount,
        blocks: blockCount,
        floors: floorCount,
        rooms: roomCount,
        departments: deptCount,
      },
    });
  })
);

/**
 * User Management
 */
router.get('/users', userCtrl.listUsers);
router.post('/users', userCtrl.createUser);
router.get('/users/:id', userCtrl.getUser);
router.put('/users/:id', userCtrl.updateUser);
router.patch('/users/:id/status', userCtrl.toggleUserStatus);
router.delete('/users/:id', userCtrl.deleteUser);

/**
 * Hostel Management
 */
router.get('/hostels', hostelCtrl.listHostels);
router.post('/hostels', hostelCtrl.createHostel);
router.get('/hostels/:id', hostelCtrl.getHostel);
router.put('/hostels/:id', hostelCtrl.updateHostel);
router.patch('/hostels/:id/status', hostelCtrl.toggleHostelStatus);
router.delete('/hostels/:id', hostelCtrl.deleteHostel);

/**
 * Block Management
 */
router.get('/blocks', blockCtrl.listBlocks);
router.post('/blocks', blockCtrl.createBlock);
router.get('/blocks/:id', blockCtrl.getBlock);
router.put('/blocks/:id', blockCtrl.updateBlock);
router.patch('/blocks/:id/status', blockCtrl.toggleBlockStatus);
router.delete('/blocks/:id', blockCtrl.deleteBlock);

/**
 * Floor Management
 */
router.get('/floors', floorCtrl.listFloors);
router.post('/floors', floorCtrl.createFloor);
router.get('/floors/:id', floorCtrl.getFloor);
router.put('/floors/:id', floorCtrl.updateFloor);
router.patch('/floors/:id/status', floorCtrl.toggleFloorStatus);
router.delete('/floors/:id', floorCtrl.deleteFloor);

/**
 * Room Management
 */
router.get('/rooms', roomCtrl.listRooms);
router.post('/rooms', roomCtrl.createRoom);
router.get('/rooms/:id', roomCtrl.getRoom);
router.put('/rooms/:id', roomCtrl.updateRoom);
router.patch('/rooms/:id/status', roomCtrl.toggleRoomStatus);
router.delete('/rooms/:id', roomCtrl.deleteRoom);

/**
 * Department Management
 */
router.get('/departments', deptCtrl.listDepartments);
router.post('/departments', deptCtrl.createDepartment);
router.get('/departments/:id', deptCtrl.getDepartment);
router.put('/departments/:id', deptCtrl.updateDepartment);
router.patch('/departments/:id/status', deptCtrl.toggleDepartmentStatus);
router.delete('/departments/:id', deptCtrl.deleteDepartment);

/**
 * Security & Compliance Audit
 */
router.get('/security-audit', securityAuditCtrl.getSecurityLogs);
router.get('/security-audit/stats', securityAuditCtrl.getSecurityStats);

export default router;
