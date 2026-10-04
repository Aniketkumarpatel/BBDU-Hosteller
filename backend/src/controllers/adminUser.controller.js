import asyncHandler from '../utils/asyncHandler.js';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import { hashPassword } from '../utils/password.js';
import { sanitizeUser } from '../utils/userSerializer.js';
import { ROLE_VALUES } from '../constants/roles.js';

export const listUsers = asyncHandler(async (req, res) => {
  const { search, role, status, hostelId } = req.query;
  const filter = {};

  if (search) {
    const s = search.trim();
    filter.$or = [
      { name: { $regex: s, $options: 'i' } },
      { email: { $regex: s, $options: 'i' } },
      { studentId: { $regex: s, $options: 'i' } },
      { employeeId: { $regex: s, $options: 'i' } },
    ];
  }

  if (role && ROLE_VALUES.includes(role)) {
    filter.role = role;
  }

  if (status === 'active') {
    filter.isActive = true;
  } else if (status === 'inactive') {
    filter.isActive = false;
  }

  if (hostelId) {
    filter.hostelId = hostelId;
  }

  const users = await User.find(filter)
    .populate('hostelId', 'name code')
    .populate('blockId', 'name code')
    .populate('floorId', 'floorNumber name')
    .populate('roomId', 'roomNumber')
    .populate('departmentId', 'name code')
    .sort({ createdAt: -1 })
    .lean();

  res.status(200).json({
    success: true,
    data: {
      users: users.map(sanitizeUser),
      total: users.length,
    },
  });
});

export const getUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id)
    .populate('hostelId', 'name code')
    .populate('blockId', 'name code')
    .populate('floorId', 'floorNumber name')
    .populate('roomId', 'roomNumber capacity currentOccupancy')
    .populate('departmentId', 'name code')
    .lean();

  if (!user) throw ApiError.notFound('User not found');

  res.status(200).json({
    success: true,
    data: { user: sanitizeUser(user) },
  });
});

export const createUser = asyncHandler(async (req, res) => {
  const {
    name,
    email,
    password,
    role,
    phone,
    studentId,
    employeeId,
    hostelId,
    blockId,
    floorId,
    roomId,
    departmentId,
    isActive,
  } = req.body;

  if (!name || !email || !password || !role) {
    throw ApiError.badRequest('Name, email, initial password, and role are required.');
  }

  if (!ROLE_VALUES.includes(role)) {
    throw ApiError.badRequest(`Role must be one of: ${ROLE_VALUES.join(', ')}`);
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    throw ApiError.conflict('A user with this email address already exists.');
  }

  const passwordHash = await hashPassword(password);

  const newUser = await User.create({
    name: name.trim(),
    email: email.toLowerCase().trim(),
    passwordHash,
    role,
    phone: phone?.trim() || undefined,
    studentId: studentId?.trim() || undefined,
    employeeId: employeeId?.trim() || undefined,
    hostelId: hostelId || undefined,
    blockId: blockId || undefined,
    floorId: floorId || undefined,
    roomId: roomId || undefined,
    departmentId: departmentId || undefined,
    isActive: isActive !== undefined ? Boolean(isActive) : true,
  });

  res.status(201).json({
    success: true,
    message: 'User created successfully',
    data: { user: sanitizeUser(newUser) },
  });
});

export const updateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    name,
    email,
    password,
    role,
    phone,
    studentId,
    employeeId,
    hostelId,
    blockId,
    floorId,
    roomId,
    departmentId,
    isActive,
  } = req.body;

  const user = await User.findById(id).select('+passwordHash');
  if (!user) throw ApiError.notFound('User not found');

  if (email && email.toLowerCase() !== user.email) {
    const existing = await User.findOne({ email: email.toLowerCase(), _id: { $ne: id } });
    if (existing) throw ApiError.conflict('Email already in use by another user.');
    user.email = email.toLowerCase().trim();
  }

  if (name) user.name = name.trim();
  if (role && ROLE_VALUES.includes(role)) user.role = role;
  if (phone !== undefined) user.phone = phone?.trim() || undefined;
  if (studentId !== undefined) user.studentId = studentId?.trim() || undefined;
  if (employeeId !== undefined) user.employeeId = employeeId?.trim() || undefined;
  if (hostelId !== undefined) user.hostelId = hostelId || undefined;
  if (blockId !== undefined) user.blockId = blockId || undefined;
  if (floorId !== undefined) user.floorId = floorId || undefined;
  if (roomId !== undefined) user.roomId = roomId || undefined;
  if (departmentId !== undefined) user.departmentId = departmentId || undefined;
  if (isActive !== undefined) user.isActive = Boolean(isActive);

  // If new password provided, rehash
  if (password && password.trim().length >= 6) {
    user.passwordHash = await hashPassword(password);
  }

  await user.save();

  res.status(200).json({
    success: true,
    message: 'User updated successfully',
    data: { user: sanitizeUser(user) },
  });
});

export const toggleUserStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (String(req.user._id) === String(id)) {
    throw ApiError.badRequest('You cannot deactivate your own account.');
  }

  const user = await User.findById(id);
  if (!user) throw ApiError.notFound('User not found');

  user.isActive = !user.isActive;
  await user.save();

  res.status(200).json({
    success: true,
    message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully`,
    data: { user: sanitizeUser(user) },
  });
});

export const deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (String(req.user._id) === String(id)) {
    throw ApiError.badRequest('You cannot delete your own account.');
  }

  const user = await User.findByIdAndDelete(id);
  if (!user) throw ApiError.notFound('User not found');

  res.status(200).json({
    success: true,
    message: 'User deleted successfully',
  });
});
