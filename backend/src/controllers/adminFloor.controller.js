import asyncHandler from '../utils/asyncHandler.js';
import Floor from '../models/Floor.js';
import Room from '../models/Room.js';
import Block from '../models/Block.js';
import Hostel from '../models/Hostel.js';
import ApiError from '../utils/ApiError.js';

export const listFloors = asyncHandler(async (req, res) => {
  const { hostelId, blockId, status } = req.query;
  const filter = {};

  if (hostelId) filter.hostelId = hostelId;
  if (blockId) filter.blockId = blockId;
  if (status === 'active') filter.isActive = true;
  if (status === 'inactive') filter.isActive = false;

  const floors = await Floor.find(filter)
    .populate('hostelId', 'name code')
    .populate('blockId', 'name code')
    .sort({ floorNumber: 1 })
    .lean();

  const floorIds = floors.map((f) => f._id);
  const roomCounts = await Room.aggregate([
    { $match: { floorId: { $in: floorIds } } },
    {
      $group: {
        _id: '$floorId',
        totalRooms: { $sum: 1 },
        totalCapacity: { $sum: '$capacity' },
        totalOccupancy: { $sum: '$currentOccupancy' },
      },
    },
  ]);

  const roomMap = Object.fromEntries(roomCounts.map((r) => [String(r._id), r]));

  const enriched = floors.map((f) => ({
    ...f,
    id: f._id,
    roomCount: roomMap[String(f._id)]?.totalRooms || 0,
    totalCapacity: roomMap[String(f._id)]?.totalCapacity || 0,
    totalOccupancy: roomMap[String(f._id)]?.totalOccupancy || 0,
  }));

  res.status(200).json({
    success: true,
    data: { floors: enriched },
  });
});

export const getFloor = asyncHandler(async (req, res) => {
  const floor = await Floor.findById(req.params.id)
    .populate('hostelId', 'name code')
    .populate('blockId', 'name code')
    .lean();
  if (!floor) throw ApiError.notFound('Floor not found');

  res.status(200).json({
    success: true,
    data: { floor: { ...floor, id: floor._id } },
  });
});

export const createFloor = asyncHandler(async (req, res) => {
  const { hostelId, blockId, floorNumber, name, isActive } = req.body;

  if (!hostelId || !blockId || floorNumber === undefined || floorNumber === null) {
    throw ApiError.badRequest('Hostel, block, and floor number are required.');
  }

  const num = Number(floorNumber);
  if (!Number.isInteger(num) || num < 0) {
    throw ApiError.badRequest('Floor number must be a non-negative integer.');
  }

  const [hostel, block] = await Promise.all([
    Hostel.findById(hostelId),
    Block.findById(blockId),
  ]);
  if (!hostel) throw ApiError.badRequest('Referenced hostel does not exist.');
  if (!block) throw ApiError.badRequest('Referenced block does not exist.');
  if (String(block.hostelId) !== String(hostelId)) {
    throw ApiError.badRequest('Block does not belong to the selected hostel.');
  }

  const existing = await Floor.findOne({ blockId, floorNumber: num });
  if (existing) {
    throw ApiError.conflict(`Floor ${num} already exists in this block.`);
  }

  const floor = await Floor.create({
    hostelId,
    blockId,
    floorNumber: num,
    name: name?.trim() || (num === 0 ? 'Ground Floor' : `Floor ${num}`),
    isActive: isActive !== undefined ? Boolean(isActive) : true,
  });

  const populated = await Floor.findById(floor._id)
    .populate('hostelId', 'name code')
    .populate('blockId', 'name code');

  res.status(201).json({
    success: true,
    message: 'Floor created successfully',
    data: { floor: populated },
  });
});

export const updateFloor = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { hostelId, blockId, floorNumber, name, isActive } = req.body;

  const floor = await Floor.findById(id);
  if (!floor) throw ApiError.notFound('Floor not found');

  if (blockId && String(blockId) !== String(floor.blockId)) {
    const block = await Block.findById(blockId);
    if (!block) throw ApiError.badRequest('Referenced block does not exist.');
    floor.blockId = blockId;
    floor.hostelId = block.hostelId;
  }

  if (floorNumber !== undefined && Number(floorNumber) !== floor.floorNumber) {
    const num = Number(floorNumber);
    if (!Number.isInteger(num) || num < 0) {
      throw ApiError.badRequest('Floor number must be a non-negative integer.');
    }
    const existing = await Floor.findOne({
      blockId: floor.blockId,
      floorNumber: num,
      _id: { $ne: id },
    });
    if (existing) {
      throw ApiError.conflict(`Floor ${num} already exists in this block.`);
    }
    floor.floorNumber = num;
  }

  if (name !== undefined) floor.name = name.trim();
  if (isActive !== undefined) floor.isActive = Boolean(isActive);

  await floor.save();
  const populated = await Floor.findById(floor._id)
    .populate('hostelId', 'name code')
    .populate('blockId', 'name code');

  res.status(200).json({
    success: true,
    message: 'Floor updated successfully',
    data: { floor: populated },
  });
});

export const toggleFloorStatus = asyncHandler(async (req, res) => {
  const floor = await Floor.findById(req.params.id);
  if (!floor) throw ApiError.notFound('Floor not found');

  floor.isActive = !floor.isActive;
  await floor.save();

  res.status(200).json({
    success: true,
    message: `Floor ${floor.isActive ? 'activated' : 'deactivated'} successfully`,
    data: { floor },
  });
});

export const deleteFloor = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const hasRooms = await Room.exists({ floorId: id });
  if (hasRooms) {
    throw ApiError.badRequest('Cannot delete floor with associated rooms. Delete or move rooms first.');
  }

  const deleted = await Floor.findByIdAndDelete(id);
  if (!deleted) throw ApiError.notFound('Floor not found');

  res.status(200).json({
    success: true,
    message: 'Floor deleted successfully',
  });
});
