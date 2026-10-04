import asyncHandler from '../utils/asyncHandler.js';
import Block from '../models/Block.js';
import Floor from '../models/Floor.js';
import Room from '../models/Room.js';
import Hostel from '../models/Hostel.js';
import ApiError from '../utils/ApiError.js';

export const listBlocks = asyncHandler(async (req, res) => {
  const { hostelId, search, status } = req.query;
  const filter = {};

  if (hostelId) filter.hostelId = hostelId;

  if (search) {
    const s = search.trim();
    filter.$or = [
      { name: { $regex: s, $options: 'i' } },
      { code: { $regex: s, $options: 'i' } },
    ];
  }

  if (status === 'active') filter.isActive = true;
  if (status === 'inactive') filter.isActive = false;

  const blocks = await Block.find(filter)
    .populate('hostelId', 'name code type')
    .sort({ name: 1 })
    .lean();

  const blockIds = blocks.map((b) => b._id);
  const [floorCounts, roomCounts] = await Promise.all([
    Floor.aggregate([
      { $match: { blockId: { $in: blockIds } } },
      { $group: { _id: '$blockId', count: { $sum: 1 } } },
    ]),
    Room.aggregate([
      { $match: { blockId: { $in: blockIds } } },
      {
        $group: {
          _id: '$blockId',
          totalRooms: { $sum: 1 },
          totalCapacity: { $sum: '$capacity' },
          totalOccupancy: { $sum: '$currentOccupancy' },
        },
      },
    ]),
  ]);

  const floorMap = Object.fromEntries(floorCounts.map((f) => [String(f._id), f.count]));
  const roomMap = Object.fromEntries(roomCounts.map((r) => [String(r._id), r]));

  const enriched = blocks.map((b) => ({
    ...b,
    id: b._id,
    floorCount: floorMap[String(b._id)] || 0,
    roomCount: roomMap[String(b._id)]?.totalRooms || 0,
    totalCapacity: roomMap[String(b._id)]?.totalCapacity || 0,
    totalOccupancy: roomMap[String(b._id)]?.totalOccupancy || 0,
  }));

  res.status(200).json({
    success: true,
    data: { blocks: enriched },
  });
});

export const getBlock = asyncHandler(async (req, res) => {
  const block = await Block.findById(req.params.id)
    .populate('hostelId', 'name code type')
    .lean();
  if (!block) throw ApiError.notFound('Block not found');

  res.status(200).json({
    success: true,
    data: { block: { ...block, id: block._id } },
  });
});

export const createBlock = asyncHandler(async (req, res) => {
  const { hostelId, name, code, description, isActive } = req.body;

  if (!hostelId || !name || !code) {
    throw ApiError.badRequest('Hostel, block name, and block code are required.');
  }

  const hostelExists = await Hostel.findById(hostelId);
  if (!hostelExists) throw ApiError.badRequest('Referenced hostel does not exist.');

  const existing = await Block.findOne({
    hostelId,
    code: code.trim().toUpperCase(),
  });
  if (existing) {
    throw ApiError.conflict(`Block with code "${code}" already exists in this hostel.`);
  }

  const block = await Block.create({
    hostelId,
    name: name.trim(),
    code: code.trim().toUpperCase(),
    description: description?.trim(),
    isActive: isActive !== undefined ? Boolean(isActive) : true,
  });

  const populated = await Block.findById(block._id).populate('hostelId', 'name code');

  res.status(201).json({
    success: true,
    message: 'Block created successfully',
    data: { block: populated },
  });
});

export const updateBlock = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { hostelId, name, code, description, isActive } = req.body;

  const block = await Block.findById(id);
  if (!block) throw ApiError.notFound('Block not found');

  if (hostelId && String(hostelId) !== String(block.hostelId)) {
    const hostelExists = await Hostel.findById(hostelId);
    if (!hostelExists) throw ApiError.badRequest('Referenced hostel does not exist.');
    block.hostelId = hostelId;
  }

  if (code) {
    const targetCode = code.trim().toUpperCase();
    const existing = await Block.findOne({
      hostelId: block.hostelId,
      code: targetCode,
      _id: { $ne: id },
    });
    if (existing) {
      throw ApiError.conflict(`Block with code "${code}" already exists in this hostel.`);
    }
    block.code = targetCode;
  }

  if (name) block.name = name.trim();
  if (description !== undefined) block.description = description?.trim();
  if (isActive !== undefined) block.isActive = Boolean(isActive);

  await block.save();
  const populated = await Block.findById(block._id).populate('hostelId', 'name code');

  res.status(200).json({
    success: true,
    message: 'Block updated successfully',
    data: { block: populated },
  });
});

export const toggleBlockStatus = asyncHandler(async (req, res) => {
  const block = await Block.findById(req.params.id);
  if (!block) throw ApiError.notFound('Block not found');

  block.isActive = !block.isActive;
  await block.save();

  res.status(200).json({
    success: true,
    message: `Block ${block.isActive ? 'activated' : 'deactivated'} successfully`,
    data: { block },
  });
});

export const deleteBlock = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const [hasFloors, hasRooms] = await Promise.all([
    Floor.exists({ blockId: id }),
    Room.exists({ blockId: id }),
  ]);

  if (hasFloors || hasRooms) {
    throw ApiError.badRequest(
      'Cannot delete block with associated floors or rooms. Remove or reassign them first.'
    );
  }

  const deleted = await Block.findByIdAndDelete(id);
  if (!deleted) throw ApiError.notFound('Block not found');

  res.status(200).json({
    success: true,
    message: 'Block deleted successfully',
  });
});
