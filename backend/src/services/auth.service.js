import mongoose from 'mongoose';
import User from '../models/User.js';
import Hostel from '../models/Hostel.js';
import Block from '../models/Block.js';
import Floor from '../models/Floor.js';
import Room from '../models/Room.js';
import Department from '../models/Department.js';
import ApiError from '../utils/ApiError.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import { signToken } from '../utils/jwt.js';
import { sanitizeUser } from '../utils/userSerializer.js';
import { logSecurityEvent } from './securityAudit.service.js';
import {
  SECURITY_EVENT_TYPES,
  SECURITY_SEVERITIES,
} from '../models/SecurityAuditLog.js';
import { ROLES } from '../constants/roles.js';

/**
 * Register a new user (defaults to STUDENT role).
 * Validates unique email, hashes password, verifies referenced entities,
 * and returns safe user + JWT token.
 */
export const registerUser = async (userData) => {
  const existingUser = await User.findOne({ email: userData.email.toLowerCase() });
  if (existingUser) {
    throw ApiError.conflict('An account with this email address already exists.');
  }

  // If hierarchy or department references are provided, verify they exist
  if (userData.hostelId) {
    const hostel = await Hostel.findById(userData.hostelId);
    if (!hostel) throw ApiError.badRequest('Referenced hostel does not exist.');
  }
  if (userData.blockId) {
    const block = await Block.findById(userData.blockId);
    if (!block) throw ApiError.badRequest('Referenced block does not exist.');
    if (userData.hostelId && String(block.hostelId) !== String(userData.hostelId)) {
      throw ApiError.badRequest('Referenced block does not belong to the selected hostel.');
    }
  }
  if (userData.floorId) {
    const floor = await Floor.findById(userData.floorId);
    if (!floor) throw ApiError.badRequest('Referenced floor does not exist.');
    if (userData.blockId && String(floor.blockId) !== String(userData.blockId)) {
      throw ApiError.badRequest('Referenced floor does not belong to the selected block.');
    }
  }
  if (userData.roomId) {
    const room = await Room.findById(userData.roomId);
    if (!room) throw ApiError.badRequest('Referenced room does not exist.');
    if (userData.floorId && String(room.floorId) !== String(userData.floorId)) {
      throw ApiError.badRequest('Referenced room does not belong to the selected floor.');
    }
  }
  if (userData.departmentId) {
    const dept = await Department.findById(userData.departmentId);
    if (!dept) throw ApiError.badRequest('Referenced department does not exist.');
  }

  const passwordHash = await hashPassword(userData.password);

  // Privilege escalation defense: public self-registration is strictly STUDENT
  let role = ROLES.STUDENT;
  if (userData.role && userData.role !== ROLES.STUDENT) {
    logSecurityEvent({
      eventType: SECURITY_EVENT_TYPES.PRIVILEGE_ESCALATION_ATTEMPT,
      severity: SECURITY_SEVERITIES.HIGH,
      actorEmail: userData.email?.toLowerCase(),
      details: {
        attemptedRole: userData.role,
        enforcedRole: ROLES.STUDENT,
        message: 'Client attempted to register administrative role via public registration endpoint.',
      },
    });
  }

  // Clean empty string optional fields to null / undefined
  const cleanedData = {
    name: userData.name,
    email: userData.email.toLowerCase(),
    passwordHash,
    role,
    isActive: true,
  };

  if (userData.phone) cleanedData.phone = userData.phone;
  if (userData.studentId) cleanedData.studentId = userData.studentId;
  if (userData.employeeId) cleanedData.employeeId = userData.employeeId;
  if (userData.hostelId) cleanedData.hostelId = userData.hostelId;
  if (userData.blockId) cleanedData.blockId = userData.blockId;
  if (userData.floorId) cleanedData.floorId = userData.floorId;
  if (userData.roomId) cleanedData.roomId = userData.roomId;
  if (userData.departmentId) cleanedData.departmentId = userData.departmentId;

  const newUser = await User.create(cleanedData);

  const safeUser = sanitizeUser(newUser);
  const token = signToken({ userId: newUser._id, role: newUser.role });

  return { user: safeUser, token };
};

/**
 * Authenticates user by email and password.
 * Checks active status and returns safe user + JWT token.
 * Uses generic "Invalid email or password" to prevent user enumeration.
 */
export const loginUser = async ({ email, password }) => {
  // Explicitly select +passwordHash because schema has select: false
  const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
  if (!user) {
    await logSecurityEvent({
      eventType: SECURITY_EVENT_TYPES.FAILED_LOGIN,
      severity: SECURITY_SEVERITIES.MEDIUM,
      actorEmail: email ? email.toLowerCase() : '',
      details: { reason: 'User not found' },
    });
    throw ApiError.unauthorized('Invalid email or password.');
  }

  const isPasswordValid = await comparePassword(password, user.passwordHash);
  if (!isPasswordValid) {
    await logSecurityEvent({
      eventType: SECURITY_EVENT_TYPES.FAILED_LOGIN,
      severity: SECURITY_SEVERITIES.MEDIUM,
      actorId: user._id,
      actorRole: user.role,
      actorEmail: user.email,
      hostelId: user.hostelId,
      details: { reason: 'Incorrect password candidate' },
    });
    throw ApiError.unauthorized('Invalid email or password.');
  }

  if (!user.isActive) {
    await logSecurityEvent({
      eventType: SECURITY_EVENT_TYPES.ACCOUNT_DEACTIVATION,
      severity: SECURITY_SEVERITIES.HIGH,
      actorId: user._id,
      actorRole: user.role,
      actorEmail: user.email,
      hostelId: user.hostelId,
      details: { reason: 'Deactivated account attempted login' },
    });
    throw ApiError.forbidden('Your account has been deactivated. Please contact the hostel administration.');
  }

  const safeUser = sanitizeUser(user);
  const token = signToken({ userId: user._id, role: user.role });

  return { user: safeUser, token };
};

/**
 * Retrieve user by ID for the /me profile endpoint.
 */
export const getUserProfile = async (userId) => {
  const user = await User.findById(userId)
    .populate('hostelId', 'name code type')
    .populate('blockId', 'name code')
    .populate('floorId', 'floorNumber name')
    .populate('roomId', 'roomNumber roomType')
    .populate('departmentId', 'name code');

  if (!user) {
    throw ApiError.notFound('User not found.');
  }

  if (!user.isActive) {
    throw ApiError.forbidden('User account is inactive.');
  }

  return sanitizeUser(user);
};
