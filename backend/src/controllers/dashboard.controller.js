import asyncHandler from '../utils/asyncHandler.js';
import { ROLES } from '../constants/roles.js';
import User from '../models/User.js';
import Hostel from '../models/Hostel.js';
import Block from '../models/Block.js';
import Floor from '../models/Floor.js';
import Room from '../models/Room.js';
import Department from '../models/Department.js';
import Complaint from '../models/Complaint.js';
import MaintenanceWorkOrder from '../models/MaintenanceWorkOrder.js';
import SlaRule from '../models/SlaRule.js';
import EscalationRule from '../models/EscalationRule.js';
import { sanitizeUser } from '../utils/userSerializer.js';
import { getStudentComplaintMetrics } from '../services/complaint.service.js';

/**
 * GET /api/dashboard/stats
 * Role-aware endpoint returning real database statistics tailored to req.user.role.
 */
export const getDashboardStats = asyncHandler(async (req, res) => {
  const { role, _id } = req.user;

  // 1. SUPER_ADMIN Stats
  if (role === ROLES.SUPER_ADMIN) {
    const [
      totalUsers,
      totalStudents,
      totalWardens,
      totalStaff,
      totalAuthorities,
      totalSuperAdmins,
      activeUsers,
      totalHostels,
      totalBlocks,
      totalFloors,
      totalRooms,
      totalDepartments,
      roomStats,
      slaActive,
      slaBreached,
      escalated,
      totalSlaRules,
      totalEscalationRules,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: ROLES.STUDENT }),
      User.countDocuments({ role: ROLES.WARDEN }),
      User.countDocuments({ role: ROLES.HOSTEL_STAFF }),
      User.countDocuments({ role: ROLES.AUTHORITY }),
      User.countDocuments({ role: ROLES.SUPER_ADMIN }),
      User.countDocuments({ isActive: true }),
      Hostel.countDocuments(),
      Block.countDocuments(),
      Floor.countDocuments(),
      Room.countDocuments(),
      Department.countDocuments(),
      Room.aggregate([
        {
          $group: {
            _id: null,
            totalCapacity: { $sum: '$capacity' },
            totalOccupancy: { $sum: '$currentOccupancy' },
          },
        },
      ]),
      Complaint.countDocuments({ slaStatus: 'ACTIVE' }),
      Complaint.countDocuments({ slaStatus: 'BREACHED' }),
      Complaint.countDocuments({ currentEscalationLevel: { $gt: 0 } }),
      SlaRule.countDocuments(),
      EscalationRule.countDocuments(),
    ]);

    const hostelDistribution = await Room.aggregate([
      {
        $group: {
          _id: '$hostelId',
          rooms: { $sum: 1 },
          capacity: { $sum: '$capacity' },
          occupancy: { $sum: '$currentOccupancy' },
        },
      },
      {
        $lookup: {
          from: 'hostels',
          localField: '_id',
          foreignField: '_id',
          as: 'hostel',
        },
      },
      { $unwind: { path: '$hostel', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          hostelId: '$_id',
          name: '$hostel.name',
          code: '$hostel.code',
          rooms: 1,
          capacity: 1,
          occupancy: 1,
        },
      },
    ]);

    return res.status(200).json({
      success: true,
      data: {
        totalUsers,
        totalStudents,
        totalWardens,
        totalStaff,
        totalAuthorities,
        totalSuperAdmins,
        activeUsers,
        totalHostels,
        totalBlocks,
        totalFloors,
        totalRooms,
        totalDepartments,
        totalCapacity: roomStats[0]?.totalCapacity || 0,
        totalOccupancy: roomStats[0]?.totalOccupancy || 0,
        hostelDistribution,
        slaStats: {
          active: slaActive,
          breached: slaBreached,
          escalated,
          totalSlaRules,
          totalEscalationRules,
        },
      },
    });
  }

  // 2. AUTHORITY Stats
  if (role === ROLES.AUTHORITY) {
    const [
      totalUsers,
      totalStudents,
      totalWardens,
      totalStaff,
      totalHostels,
      totalBlocks,
      totalRooms,
      activeUsers,
      hostelsList,
      occupancyStats,
      hostelBreakdownAgg,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: ROLES.STUDENT }),
      User.countDocuments({ role: ROLES.WARDEN }),
      User.countDocuments({ role: ROLES.HOSTEL_STAFF }),
      Hostel.countDocuments(),
      Block.countDocuments(),
      Room.countDocuments(),
      User.countDocuments({ isActive: true }),
      Hostel.find().select('name code type isActive description').lean(),
      Room.aggregate([
        {
          $group: {
            _id: null,
            totalCapacity: { $sum: '$capacity' },
            totalOccupancy: { $sum: '$currentOccupancy' },
          },
        },
      ]),
      Room.aggregate([
        {
          $group: {
            _id: '$hostelId',
            roomsCount: { $sum: 1 },
            capacity: { $sum: '$capacity' },
            occupancy: { $sum: '$currentOccupancy' },
          },
        },
      ]),
    ]);

    const hostelStatsMap = new Map();
    hostelBreakdownAgg.forEach((item) => {
      if (item._id) {
        hostelStatsMap.set(String(item._id), item);
      }
    });

    const blockCounts = await Block.aggregate([
      { $group: { _id: '$hostelId', blocksCount: { $sum: 1 } } },
    ]);
    const blockCountsMap = new Map();
    blockCounts.forEach((b) => {
      if (b._id) blockCountsMap.set(String(b._id), b.blocksCount);
    });

    const detailedHostels = hostelsList.map((h) => {
      const stats = hostelStatsMap.get(String(h._id)) || { roomsCount: 0, capacity: 0, occupancy: 0 };
      const blocksCount = blockCountsMap.get(String(h._id)) || 0;
      return {
        _id: h._id,
        name: h.name,
        code: h.code,
        type: h.type,
        isActive: h.isActive,
        blocksCount,
        roomsCount: stats.roomsCount,
        capacity: stats.capacity,
        occupancy: stats.occupancy,
      };
    });

    const [slaActive, slaBreached, escalatedComplaints] = await Promise.all([
      Complaint.countDocuments({ slaStatus: 'ACTIVE' }),
      Complaint.countDocuments({ slaStatus: 'BREACHED' }),
      Complaint.countDocuments({ currentEscalationLevel: { $gt: 0 } }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        totalUsers,
        totalStudents,
        totalWardens,
        totalStaff,
        totalHostels,
        totalBlocks,
        totalRooms,
        activeUsers,
        totalCapacity: occupancyStats[0]?.totalCapacity || 0,
        totalOccupancy: occupancyStats[0]?.totalOccupancy || 0,
        hostels: detailedHostels,
        slaStats: {
          active: slaActive,
          breached: slaBreached,
          escalated: escalatedComplaints,
        },
      },
    });
  }

  // 3. WARDEN Stats
  if (role === ROLES.WARDEN) {
    const warden = await User.findById(_id)
      .populate('hostelId', 'name code type address description isActive')
      .lean();

    const hostel = warden.hostelId;
    if (!hostel) {
      return res.status(200).json({
        success: true,
        data: {
          hostel: null,
          hasAssignedHostel: false,
          message: 'No hostel has been assigned to your warden account yet.',
          studentsCount: 0,
          roomsCount: 0,
          staffCount: 0,
          slaStats: { active: 0, breached: 0, dueSoon: 0, escalated: 0 },
        },
      });
    }

    const now = new Date();
    const fourHoursFromNow = new Date(now.getTime() + 4 * 3600 * 1000);

    const [
      studentsCount,
      roomsCount,
      staffCount,
      roomStats,
      blocks,
      recentStudents,
      slaActive,
      slaBreached,
      dueSoon,
      escalated,
    ] = await Promise.all([
      User.countDocuments({ hostelId: hostel._id, role: ROLES.STUDENT, isActive: true }),
      Room.countDocuments({ hostelId: hostel._id, isActive: true }),
      User.countDocuments({ hostelId: hostel._id, role: ROLES.HOSTEL_STAFF, isActive: true }),
      Room.aggregate([
        { $match: { hostelId: hostel._id, isActive: true } },
        {
          $group: {
            _id: null,
            totalCapacity: { $sum: '$capacity' },
            totalOccupancy: { $sum: '$currentOccupancy' },
          },
        },
      ]),
      Block.find({ hostelId: hostel._id, isActive: true }).select('name code').lean(),
      User.find({ hostelId: hostel._id, role: ROLES.STUDENT, isActive: true })
        .populate('roomId', 'roomNumber')
        .select('name email studentId roomId')
        .limit(5)
        .lean(),
      Complaint.countDocuments({ hostelId: hostel._id, slaStatus: 'ACTIVE' }),
      Complaint.countDocuments({ hostelId: hostel._id, slaStatus: 'BREACHED' }),
      Complaint.countDocuments({
        hostelId: hostel._id,
        slaStatus: 'ACTIVE',
        slaDueAt: { $gte: now, $lte: fourHoursFromNow },
      }),
      Complaint.countDocuments({ hostelId: hostel._id, currentEscalationLevel: { $gt: 0 } }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        hasAssignedHostel: true,
        hostel,
        studentsCount,
        roomsCount,
        staffCount,
        totalCapacity: roomStats[0]?.totalCapacity || 0,
        totalOccupancy: roomStats[0]?.totalOccupancy || 0,
        blocks,
        recentStudents: recentStudents.map((s) => ({
          id: s._id,
          name: s.name,
          email: s.email,
          studentId: s.studentId,
          roomNumber: s.roomId?.roomNumber || 'Unassigned',
        })),
        slaStats: {
          active: slaActive,
          breached: slaBreached,
          dueSoon,
          escalated,
        },
      },
    });
  }

  // 4. HOSTEL_STAFF Stats
  if (role === ROLES.HOSTEL_STAFF) {
    const staff = await User.findById(_id)
      .populate('hostelId', 'name code type address')
      .populate('blockId', 'name code')
      .populate('departmentId', 'name code')
      .lean();

    const now = new Date();
    const fourHoursFromNow = new Date(now.getTime() + 4 * 3600 * 1000);

    let hostelStats = { roomsCount: 0, studentsCount: 0 };
    if (staff.hostelId) {
      const [roomsCount, studentsCount] = await Promise.all([
        Room.countDocuments({ hostelId: staff.hostelId._id, isActive: true }),
        User.countDocuments({ hostelId: staff.hostelId._id, role: ROLES.STUDENT, isActive: true }),
      ]);
      hostelStats = { roomsCount, studentsCount };
    }

    const staffOrFilter = [{ assignedTo: _id }];
    if (staff.departmentId) {
      staffOrFilter.push({ departmentId: staff.departmentId._id });
    }

    const [
      slaActive,
      slaBreached,
      dueSoon,
      escalated,
      countAssigned,
      countAcknowledged,
      countInProgress,
      countReopened,
      countVerification,
      recentAssignedComplaints,
      recentWorkOrders,
    ] = await Promise.all([
      Complaint.countDocuments({ $or: staffOrFilter, slaStatus: 'ACTIVE' }),
      Complaint.countDocuments({ $or: staffOrFilter, slaStatus: 'BREACHED' }),
      Complaint.countDocuments({
        $or: staffOrFilter,
        slaStatus: 'ACTIVE',
        slaDueAt: { $gte: now, $lte: fourHoursFromNow },
      }),
      Complaint.countDocuments({ $or: staffOrFilter, currentEscalationLevel: { $gt: 0 } }),
      Complaint.countDocuments({ $or: staffOrFilter, status: 'ASSIGNED' }),
      Complaint.countDocuments({ $or: staffOrFilter, status: 'ACKNOWLEDGED' }),
      Complaint.countDocuments({ $or: staffOrFilter, status: 'IN_PROGRESS' }),
      Complaint.countDocuments({ $or: staffOrFilter, status: 'REOPENED' }),
      Complaint.countDocuments({ $or: staffOrFilter, status: 'STUDENT_VERIFICATION' }),
      Complaint.find({
        $or: staffOrFilter,
        status: { $nin: ['CLOSED', 'REJECTED'] },
      })
        .sort({ updatedAt: -1, createdAt: -1 })
        .limit(8)
        .populate('studentId', 'name email studentId phone')
        .populate('hostelId', 'name code')
        .populate('blockId', 'name')
        .populate('roomId', 'roomNumber')
        .populate('departmentId', 'name code')
        .populate('assignedTo', 'name email employeeId')
        .lean(),
      MaintenanceWorkOrder.find({
        $or: [{ assignedTo: _id }, ...(staff.hostelId ? [{ hostelId: staff.hostelId._id }] : [])],
        status: { $nin: ['COMPLETED', 'CANCELLED'] },
      })
        .sort({ updatedAt: -1, createdAt: -1 })
        .limit(5)
        .populate('hostelId', 'name')
        .populate('roomId', 'roomNumber')
        .populate('departmentId', 'name')
        .populate('assignedTo', 'name employeeId')
        .lean(),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        staff: sanitizeUser(staff),
        hostel: staff.hostelId || null,
        block: staff.blockId || null,
        department: staff.departmentId || null,
        operationalOverview: hostelStats,
        slaStats: {
          active: slaActive,
          breached: slaBreached,
          dueSoon,
          escalated,
        },
        taskMetrics: {
          assigned: countAssigned,
          acknowledged: countAcknowledged,
          inProgress: countInProgress,
          reopened: countReopened,
          verification: countVerification,
          totalActive: countAssigned + countAcknowledged + countInProgress + countReopened + countVerification,
        },
        assignedComplaints: recentAssignedComplaints,
        assignedWorkOrders: recentWorkOrders,
      },
    });
  }

  // 5. STUDENT Stats
  if (role === ROLES.STUDENT) {
    const student = await User.findById(_id)
      .populate('hostelId', 'name code type address description')
      .populate('blockId', 'name code')
      .populate('floorId', 'floorNumber name')
      .populate('roomId', 'roomNumber roomType capacity currentOccupancy')
      .populate('departmentId', 'name code')
      .lean();

    const [roommates, complaintMetrics] = await Promise.all([
      student.roomId
        ? User.find({
            roomId: student.roomId._id,
            _id: { $ne: student._id },
            isActive: true,
          })
            .select('name email studentId')
            .lean()
        : Promise.resolve([]),
      getStudentComplaintMetrics(_id),
    ]);

    let hostel = student.hostelId || null;
    let block = student.blockId || null;
    let floor = student.floorId || null;
    let room = student.roomId || null;

    if (!room && student.roomNumber) {
      room = { roomNumber: student.roomNumber };
    }

    return res.status(200).json({
      success: true,
      data: {
        student: sanitizeUser(student),
        hostel,
        block,
        floor,
        room,
        department: student.departmentId || null,
        roommates: roommates.map((r) => ({
          id: r._id,
          name: r.name,
          email: r.email,
          studentId: r.studentId,
        })),
        complaintMetrics,
      },
    });
  }

  return res.status(200).json({
    success: true,
    data: {},
  });
});
