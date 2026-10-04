import asyncHandler from '../utils/asyncHandler.js';
import * as authService from '../services/auth.service.js';

/**
 * POST /api/auth/register
 */
export const register = asyncHandler(async (req, res) => {
  const result = await authService.registerUser(req.body);
  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: result,
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
 * POST /api/auth/logout
 * Stateless JWT logout: client discards token.
 */
export const logout = asyncHandler(async (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'Logged out successfully. Please clear stored credentials.',
  });
});
