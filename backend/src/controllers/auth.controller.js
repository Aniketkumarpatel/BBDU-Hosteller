import asyncHandler from '../utils/asyncHandler.js';
import * as authService from '../services/auth.service.js';

/**
 * POST /api/auth/register
 */
export const register = asyncHandler(async (req, res) => {
  const result = await authService.registerUser(req.body);
  const status = result.isReRegistration ? 200 : 201;
  const message = result.isReRegistration
    ? 'Registration details updated successfully'
    : 'User registered successfully';
  res.status(status).json({
    success: true,
    message,
    data: { user: result.user, token: result.token },
  });
});

/**
 * POST /api/auth/login
 */
export const login = asyncHandler(async (req, res) => {
  const result = await authService.loginUser(req.body);
  res.status(200).json({
    success: true,
    message: 'Login successful',
    data: result,
  });
});

/**
 * GET /api/auth/me
 */
export const getMe = asyncHandler(async (req, res) => {
  const user = await authService.getUserProfile(req.user._id);
  res.status(200).json({
    success: true,
    data: { user },
  });
});

/**
 * GET /api/auth/hostels
 * Public endpoint to list active hostels for registration dropdown.
 */
export const getPublicHostels = asyncHandler(async (_req, res) => {
  const hostels = await authService.getPublicHostels();
  res.status(200).json({
    success: true,
    data: { hostels },
  });
});

/**
 * GET /api/auth/blocks?hostelId=:hostelId
 * Public endpoint to list active blocks belonging to a hostel.
 */
export const getPublicBlocks = asyncHandler(async (req, res) => {
  const blocks = await authService.getPublicBlocks(req.query.hostelId);
  res.status(200).json({
    success: true,
    data: { blocks },
  });
});

/**
 * GET /api/auth/floors?blockId=:blockId
 * Public endpoint to list active floors belonging to a block.
 */
export const getPublicFloors = asyncHandler(async (req, res) => {
  const floors = await authService.getPublicFloors(req.query.blockId);
  res.status(200).json({
    success: true,
    data: { floors },
  });
});

/**
 * GET /api/auth/rooms?floorId=:floorId
 * Public endpoint to list available active rooms belonging to a floor.
 */
export const getPublicRooms = asyncHandler(async (req, res) => {
  const rooms = await authService.getPublicRooms(req.query.floorId);
  res.status(200).json({
    success: true,
    data: { rooms },
  });
});

/**
 * POST /api/auth/logout
 * Stateless JWT logout: client discards token.
 */
export const logout = asyncHandler(async (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'Logged out successfully. Please clear stored credentials.',
  });
});
