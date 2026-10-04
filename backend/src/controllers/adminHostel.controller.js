import asyncHandler from '../utils/asyncHandler.js';
import Hostel from '../models/Hostel.js';
import Block from '../models/Block.js';
import Room from '../models/Room.js';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import { HOSTEL_TYPE_VALUES } from '../constants/hostel.js';

export const listHostels = asyncHandler(async (req, res) => {
  const { search, type, status } = req.query;
  const filter = {};

  if (search) {
    const s = search.trim();
    filter.$or = [
      { name: { $regex: s, $options: 'i' } },
      { code: { $regex: s, $options: 'i' } },
      { address: { $regex: s, $options: 'i' } },
    ];
  }

  if (type && HOSTEL_TYPE_VALUES.includes(type)) {
    filter.type = type;
  }

  if (status === 'active') {
    filter.isActive = true;
  } else if (status === 'inactive') {
    filter.isActive = false;
  }

  const hostels = await Hostel.find(filter).sort({ name: 1 }).lean();

  // Aggregate room and block counts for each hostel
  const hostelIds = hostels.map((h) => h._id);
  const [blockCounts, roomStats, residentCounts] = await Promise.all([
    Block.aggregate([
      { $match: { hostelId: { $in: hostelIds } } },
      { $group: { _id: '$hostelId', count: { $sum: 1 } } },
    ]),
    Room.aggregate([
      { $match: { hostelId: { $in: hostelIds } } },
      {
        $group: {
          _id: '$hostelId',
          totalRooms: { $sum: 1 },
          totalCapacity: { $sum: '$capacity' },
          totalOccupancy: { $sum: '$currentOccupancy' },
        },
      },
    ]),
    User.aggregate([
      { $match: { hostelId: { $in: hostelIds }, role: 'STUDENT', isActive: true } },
      { $group: { _id: '$hostelId', count: { $sum: 1 } } },
    ]),
  ]);

  const blockMap = Object.fromEntries(blockCounts.map((b) => [String(b._id), b.count]));
  const roomMap = Object.fromEntries(roomStats.map((r) => [String(r._id), r]));
  const residentMap = Object.fromEntries(residentCounts.map((u) => [String(u._id), u.count]));

  const enriched = hostels.map((h) => ({
    ...h,
    id: h._id,
    blockCount: blockMap[String(h._id)] || 0,
    roomCount: roomMap[String(h._id)]?.totalRooms || 0,
    totalCapacity: roomMap[String(h._id)]?.totalCapacity || 0,
    totalOccupancy: roomMap[String(h._id)]?.totalOccupancy || 0,
    studentCount: residentMap[String(h._id)] || 0,
  }));

  res.status(200).json({
    success: true,
    data: { hostels: enriched },
  });
});

export const getHostel = asyncHandler(async (req, res) => {
  const hostel = await Hostel.findById(req.params.id).lean();
  if (!hostel) throw ApiError.notFound('Hostel not found');

  res.status(200).json({
    success: true,
    data: { hostel: { ...hostel, id: hostel._id } },
  });
});

export const createHostel = asyncHandler(async (req, res) => {
  const { name, code, type, address, description, isActive } = req.body;

  if (!name || !code) {
    throw ApiError.badRequest('Hostel name and code are required.');
  }

  const existing = await Hostel.findOne({ code: code.trim().toUpperCase() });
  if (existing) {
    throw ApiError.conflict(`Hostel with code "${code}" already exists.`);
  }

  const hostel = await Hostel.create({
    name: name.trim(),
    code: code.trim().toUpperCase(),
    type: type || 'MIXED',
    address: address?.trim(),
    description: description?.trim(),
    isActive: isActive !== undefined ? Boolean(isActive) : true,
  });

  res.status(201).json({
    success: true,
    message: 'Hostel created successfully',
    data: { hostel },
  });
});

export const updateHostel = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, code, type, address, description, isActive } = req.body;

  const hostel = await Hostel.findById(id);
  if (!hostel) throw ApiError.notFound('Hostel not found');

  if (code && code.trim().toUpperCase() !== hostel.code) {
    const existing = await Hostel.findOne({ code: code.trim().toUpperCase(), _id: { $ne: id } });
    if (existing) throw ApiError.conflict(`Hostel with code "${code}" already exists.`);
    hostel.code = code.trim().toUpperCase();
  }

  if (name) hostel.name = name.trim();
  if (type) hostel.type = type;
  if (address !== undefined) hostel.address = address?.trim();
  if (description !== undefined) hostel.description = description?.trim();
  if (isActive !== undefined) hostel.isActive = Boolean(isActive);

  await hostel.save();

  res.status(200).json({
    success: true,
    message: 'Hostel updated successfully',
    data: { hostel },
  });
});

export const toggleHostelStatus = asyncHandler(async (req, res) => {
  const hostel = await Hostel.findById(req.params.id);
  if (!hostel) throw ApiError.notFound('Hostel not found');

  hostel.isActive = !hostel.isActive;
  await hostel.save();

  res.status(200).json({
    success: true,
    message: `Hostel ${hostel.isActive ? 'activated' : 'deactivated'} successfully`,
    data: { hostel },
  });
});

export const deleteHostel = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check for dependent blocks or users
  const [hasBlocks, hasResidents] = await Promise.all([
    Block.exists({ hostelId: id }),
    User.exists({ hostelId: id }),
  ]);

  if (hasBlocks || hasResidents) {
    throw ApiError.badRequest(
      'Cannot delete hostel because blocks or residents are linked to it. Deactivate the hostel or reassign dependencies first.'
    );
  }

  const deleted = await Hostel.findByIdAndDelete(id);
  if (!deleted) throw ApiError.notFound('Hostel not found');

  res.status(200).json({
    success: true,
    message: 'Hostel deleted successfully',
  });
});
