import asyncHandler from '../utils/asyncHandler.js';
import Room from '../models/Room.js';
import Floor from '../models/Floor.js';
import Block from '../models/Block.js';
import Hostel from '../models/Hostel.js';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import { ROOM_TYPE_VALUES } from '../constants/hostel.js';

export const listRooms = asyncHandler(async (req, res) => {
  const { hostelId, blockId, floorId, search, status, roomType } = req.query;
  const filter = {};

  if (hostelId) filter.hostelId = hostelId;
  if (blockId) filter.blockId = blockId;
  if (floorId) filter.floorId = floorId;
  if (roomType && ROOM_TYPE_VALUES.includes(roomType)) filter.roomType = roomType;

  if (search) {
    filter.roomNumber = { $regex: search.trim(), $options: 'i' };
  }

  if (status === 'active') filter.isActive = true;
  if (status === 'inactive') filter.isActive = false;

  const rooms = await Room.find(filter)
    .populate('hostelId', 'name code')
    .populate('blockId', 'name code')
    .populate('floorId', 'floorNumber name')
    .sort({ roomNumber: 1 })
    .lean();

  const enriched = rooms.map((r) => ({
    ...r,
    id: r._id,
    availableSlots: Math.max(0, (r.capacity || 0) - (r.currentOccupancy || 0)),
  }));

  res.status(200).json({
    success: true,
    data: { rooms: enriched },
  });
});

export const getRoom = asyncHandler(async (req, res) => {
  const room = await Room.findById(req.params.id)
    .populate('hostelId', 'name code')
    .populate('blockId', 'name code')
    .populate('floorId', 'floorNumber name')
    .lean();
  if (!room) throw ApiError.notFound('Room not found');

  const residents = await User.find({ roomId: room._id, isActive: true })
    .select('name email studentId')
    .lean();

  res.status(200).json({
    success: true,
    data: {
      room: {
        ...room,
        id: room._id,
        availableSlots: Math.max(0, (room.capacity || 0) - (room.currentOccupancy || 0)),
        residents,
      },
    },
  });
});

export const createRoom = asyncHandler(async (req, res) => {
  const {
    hostelId,
    blockId,
    floorId,
    roomNumber,
    roomType,
    capacity,
    currentOccupancy,
    isActive,
  } = req.body;

  if (!hostelId || !blockId || !floorId || !roomNumber || !roomType || !capacity) {
    throw ApiError.badRequest('Hostel, block, floor, room number, room type, and capacity are required.');
  }

  const cap = Number(capacity);
  const occ = currentOccupancy !== undefined ? Number(currentOccupancy) : 0;

  if (isNaN(cap) || cap < 1) {
    throw ApiError.badRequest('Capacity must be a positive integer.');
  }
  if (isNaN(occ) || occ < 0) {
    throw ApiError.badRequest('Current occupancy must be non-negative.');
  }
  if (occ > cap) {
    throw ApiError.badRequest('currentOccupancy cannot be greater than capacity.');
  }

  // Verify hierarchy integrity
  const [hostel, block, floor] = await Promise.all([
    Hostel.findById(hostelId),
    Block.findById(blockId),
    Floor.findById(floorId),
  ]);

  if (!hostel) throw ApiError.badRequest('Referenced hostel does not exist.');
  if (!block) throw ApiError.badRequest('Referenced block does not exist.');
  if (!floor) throw ApiError.badRequest('Referenced floor does not exist.');

  if (String(block.hostelId) !== String(hostelId)) {
    throw ApiError.badRequest('Block does not belong to the selected hostel.');
  }
  if (String(floor.blockId) !== String(blockId)) {
    throw ApiError.badRequest('Floor does not belong to the selected block.');
  }

  const existing = await Room.findOne({
    floorId,
    roomNumber: roomNumber.trim().toUpperCase(),
  });
  if (existing) {
    throw ApiError.conflict(`Room "${roomNumber}" already exists on this floor.`);
  }

  const room = await Room.create({
    hostelId,
    blockId,
    floorId,
    roomNumber: roomNumber.trim().toUpperCase(),
    roomType,
    capacity: cap,
    currentOccupancy: occ,
    isActive: isActive !== undefined ? Boolean(isActive) : true,
  });

  const populated = await Room.findById(room._id)
    .populate('hostelId', 'name code')
    .populate('blockId', 'name code')
    .populate('floorId', 'floorNumber name');

  res.status(201).json({
    success: true,
    message: 'Room created successfully',
    data: { room: populated },
  });
});

export const updateRoom = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { roomNumber, roomType, capacity, currentOccupancy, isActive } = req.body;

  const room = await Room.findById(id);
  if (!room) throw ApiError.notFound('Room not found');

  const newCap = capacity !== undefined ? Number(capacity) : room.capacity;
  const newOcc = currentOccupancy !== undefined ? Number(currentOccupancy) : room.currentOccupancy;

  if (newOcc > newCap) {
    throw ApiError.badRequest('currentOccupancy cannot be greater than capacity.');
  }

  if (roomNumber) {
    const target = roomNumber.trim().toUpperCase();
    const existing = await Room.findOne({
      floorId: room.floorId,
      roomNumber: target,
      _id: { $ne: id },
    });
    if (existing) {
      throw ApiError.conflict(`Room "${roomNumber}" already exists on this floor.`);
    }
    room.roomNumber = target;
  }

  if (roomType && ROOM_TYPE_VALUES.includes(roomType)) room.roomType = roomType;
  room.capacity = newCap;
  room.currentOccupancy = newOcc;
  if (isActive !== undefined) room.isActive = Boolean(isActive);

  await room.save();
  const populated = await Room.findById(room._id)
    .populate('hostelId', 'name code')
    .populate('blockId', 'name code')
    .populate('floorId', 'floorNumber name');

  res.status(200).json({
    success: true,
    message: 'Room updated successfully',
    data: { room: populated },
  });
});

export const toggleRoomStatus = asyncHandler(async (req, res) => {
  const room = await Room.findById(req.params.id);
  if (!room) throw ApiError.notFound('Room not found');

  room.isActive = !room.isActive;
  await room.save();

  res.status(200).json({
    success: true,
    message: `Room ${room.isActive ? 'activated' : 'deactivated'} successfully`,
    data: { room },
  });
});

export const deleteRoom = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const hasResidents = await User.exists({ roomId: id, isActive: true });
  if (hasResidents) {
    throw ApiError.badRequest('Cannot delete room with active residents assigned.');
  }

  const deleted = await Room.findByIdAndDelete(id);
  if (!deleted) throw ApiError.notFound('Room not found');

  res.status(200).json({
    success: true,
    message: 'Room deleted successfully',
  });
});
