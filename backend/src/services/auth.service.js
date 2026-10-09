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
import { generateTemporaryPassword } from '../utils/temporaryPassword.js';
import { sanitizeUser } from '../utils/userSerializer.js';
import { logSecurityEvent } from './securityAudit.service.js';
import {
  SECURITY_EVENT_TYPES,
  SECURITY_SEVERITIES,
} from '../models/SecurityAuditLog.js';
import { ROLES } from '../constants/roles.js';

export const OFFICIAL_HOSTELS = [
  { name: 'BBDU A and B Block', code: 'BBDU-AB', type: 'BOYS', address: 'BBD University Campus, Lucknow' },
  { name: 'BBDU C and D Block', code: 'BBDU-CD', type: 'BOYS', address: 'BBD University Campus, Lucknow' },
  { name: 'Dr. Nirmala Devi Girls Hostel', code: 'NDGH', type: 'GIRLS', address: 'BBD University Campus, Lucknow' },
  { name: 'Justice D.P. Gupta Girls Hostel', code: 'DPGGH', type: 'GIRLS', address: 'BBD University Campus, Lucknow' },
  { name: 'Sheela Devi Girls Hostel', code: 'SDGH', type: 'GIRLS', address: 'BBD University Campus, Lucknow' },
  { name: 'Shail Devi Girls Hostel', code: 'SHDGH', type: 'GIRLS', address: 'BBD University Campus, Lucknow' },
  { name: 'BBDU Girls Hostel', code: 'BBDGH', type: 'GIRLS', address: 'BBD University Campus, Lucknow' },
];

/**
 * Ensures the 7 official BBDU hostels, blocks (1, 2, 3), floors (1, 2, 3, 4, 5), and rooms exist.
 */
export const ensureHostelHierarchySeeded = async () => {
  // Safely update legacy 'BBDU Devi Girls Hostel' to 'BBDU Girls Hostel'
  await Hostel.updateMany(
    { name: 'BBDU Devi Girls Hostel' },
    { $set: { name: 'BBDU Girls Hostel', code: 'BBDGH' } }
  );

  const count = await Hostel.countDocuments({
    name: { $in: OFFICIAL_HOSTELS.map((h) => h.name) },
  });
  if (count < 7) {
    for (const hData of OFFICIAL_HOSTELS) {
      let hostel = await Hostel.findOne({ name: hData.name });
      if (!hostel) {
        hostel = await Hostel.findOne({ code: hData.code });
      }
      if (!hostel) {
        hostel = await Hostel.create({
          name: hData.name,
          code: hData.code,
          type: hData.type,
          address: hData.address,
          description: `${hData.name} - BBDU Residential Block`,
        });
      }

      for (const blockNum of ['1', '2', '3']) {
        let block = await Block.findOne({ hostelId: hostel._id, code: blockNum });
        if (!block) {
          block = await Block.create({
            hostelId: hostel._id,
            name: blockNum,
            code: blockNum,
            description: `Block ${blockNum}`,
          });
        }

        for (const floorNum of [1, 2, 3, 4, 5]) {
          let floor = await Floor.findOne({ blockId: block._id, floorNumber: floorNum });
          if (!floor) {
            floor = await Floor.create({
              hostelId: hostel._id,
              blockId: block._id,
              floorNumber: floorNum,
              name: `${floorNum}`,
            });
          }
        }
      }
    }
  }
};

/**
 * Public lookup for active hostels. Auto-seeds if missing.
 */
export const getPublicHostels = async () => {
  await ensureHostelHierarchySeeded();
  return Hostel.find({
    name: { $in: OFFICIAL_HOSTELS.map((h) => h.name) },
    isActive: true,
  })
    .select('_id name code type')
    .sort({ name: 1 })
    .lean();
};

/**
 * Public lookup for active blocks in a hostel. Auto-creates blocks 1, 2, 3 if needed.
 */
export const getPublicBlocks = async (hostelId) => {
  if (!hostelId) throw ApiError.badRequest('hostelId query parameter is required.');
  let blocks = await Block.find({ hostelId, isActive: true })
    .select('_id name code hostelId')
    .sort({ name: 1 })
    .lean();

  if (blocks.length === 0) {
    for (const blockNum of ['1', '2', '3']) {
      await Block.create({ hostelId, name: blockNum, code: blockNum });
    }
    blocks = await Block.find({ hostelId, isActive: true })
      .select('_id name code hostelId')
      .sort({ name: 1 })
      .lean();
  }
  return blocks;
};

/**
 * Public lookup for active floors in a block. Auto-creates floors 1, 2, 3, 4, 5 if needed.
 */
export const getPublicFloors = async (blockId) => {
  if (!blockId) throw ApiError.badRequest('blockId query parameter is required.');
  const block = await Block.findById(blockId);
  if (block) {
    for (const floorNum of [1, 2, 3, 4, 5]) {
      let floor = await Floor.findOne({ blockId, floorNumber: floorNum });
      if (!floor) {
        await Floor.create({
          hostelId: block.hostelId,
          blockId,
          floorNumber: floorNum,
          name: `${floorNum}`,
        });
      }
    }
  }

  return Floor.find({ blockId, isActive: true })
    .select('_id floorNumber name blockId hostelId')
    .sort({ floorNumber: 1 })
    .lean();
};

/**
 * Public lookup for available active rooms in a floor. Auto-creates rooms 101-105 if needed.
 */
export const getPublicRooms = async (floorId) => {
  if (!floorId) throw ApiError.badRequest('floorId query parameter is required.');
  let rooms = await Room.find({
    floorId,
    isActive: true,
    $expr: { $lt: ['$currentOccupancy', '$capacity'] },
  })
    .select('_id roomNumber roomType capacity currentOccupancy floorId blockId hostelId')
    .sort({ roomNumber: 1 })
    .lean();

  if (rooms.length === 0) {
    const floor = await Floor.findById(floorId);
    if (floor) {
      const roomNumbers = [1, 2, 3, 4, 5].map((idx) => `${floor.floorNumber || 1}0${idx}`);
      for (const rNum of roomNumbers) {
        await Room.create({
          hostelId: floor.hostelId,
          blockId: floor.blockId,
          floorId,
          roomNumber: rNum,
          roomType: 'DOUBLE',
          capacity: 2,
          currentOccupancy: 0,
        });
      }
      rooms = await Room.find({
        floorId,
        isActive: true,
        $expr: { $lt: ['$currentOccupancy', '$capacity'] },
      })
        .select('_id roomNumber roomType capacity currentOccupancy floorId blockId hostelId')
        .sort({ roomNumber: 1 })
        .lean();
    }
  }
  return rooms;
};

/**
 * Register a new user (defaults to STUDENT role).
 * Validates unique email, Student ID, verifies hostel allocation hierarchy,
 * atomically reserves room occupancy, and returns safe user + JWT token.
 */
export const registerUser = async (userData) => {
  const email = (userData.email || '').trim().toLowerCase();
  if (!email.endsWith('@bbdu.ac.in')) {
    throw ApiError.badRequest('Please use your official BBDU email address ending with @bbdu.ac.in.');
  }

  let existingUser = await User.findOne({ email }).select('+passwordHash');
  if (!existingUser && userData.studentId) {
    existingUser = await User.findOne({ studentId: userData.studentId.trim().toUpperCase() }).select('+passwordHash');
  }

  let isReRegistration = false;
  if (existingUser) {
    // Security check: verify password before allowing re-registration profile/allocation update
    const isPasswordValid = await comparePassword(userData.password, existingUser.passwordHash);
    if (!isPasswordValid) {
      if (existingUser.email === email) {
        throw ApiError.conflict('An account with this email address already exists.');
      } else {
        throw ApiError.conflict('A student account with this Student ID already exists.');
      }
    }
    isReRegistration = true;
  }

  // Validate required hostel allocation hierarchy fields
  if (!userData.hostelId) throw ApiError.badRequest('Hostel Name is required.');
  if (!userData.blockId) throw ApiError.badRequest('Block/Wing is required.');
  if (!userData.floorId) throw ApiError.badRequest('Floor is required.');

  const typedRoomNumber = String(userData.roomNumber || userData.roomId || '').trim();
  if (!typedRoomNumber) throw ApiError.badRequest('Room Number is required.');

  // Verify hierarchy existence and parent-child ownership
  const hostel = await Hostel.findById(userData.hostelId);
  if (!hostel || !hostel.isActive) {
    throw ApiError.badRequest('Referenced hostel does not exist or is inactive.');
  }

  const block = await Block.findById(userData.blockId);
  if (!block || !block.isActive) {
    throw ApiError.badRequest('Referenced block does not exist or is inactive.');
  }
  if (String(block.hostelId) !== String(userData.hostelId)) {
    throw ApiError.badRequest('Selected block does not belong to the selected hostel.');
  }

  const floor = await Floor.findById(userData.floorId);
  if (!floor || !floor.isActive) {
    throw ApiError.badRequest('Referenced floor does not exist or is inactive.');
  }
  if (String(floor.blockId) !== String(userData.blockId) || String(floor.hostelId) !== String(userData.hostelId)) {
    throw ApiError.badRequest('Selected floor does not belong to the selected block.');
  }

  // Resolve or create Room document for the typed room number under the selected floor
  let room;
  if (mongoose.Types.ObjectId.isValid(typedRoomNumber)) {
    room = await Room.findById(typedRoomNumber);
  }
  if (!room) {
    room = await Room.findOne({ floorId: floor._id, roomNumber: typedRoomNumber });
  }
  if (!room) {
    room = await Room.create({
      hostelId: hostel._id,
      blockId: block._id,
      floorId: floor._id,
      roomNumber: typedRoomNumber,
      roomType: 'DOUBLE',
      capacity: 10,
      currentOccupancy: 0,
    });
  }

  // Atomically increment room occupancy
  await Room.findByIdAndUpdate(room._id, { $inc: { currentOccupancy: 1 } });

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

  const cleanedData = {
    name: userData.name.trim(),
    email,
    passwordHash,
    role,
    isActive: true,
    hostelId: userData.hostelId,
    blockId: userData.blockId,
    floorId: userData.floorId,
    roomId: room._id,
    roomNumber: typedRoomNumber,
  };

  if (userData.phone) cleanedData.phone = userData.phone.trim();
  if (userData.studentId) cleanedData.studentId = userData.studentId.trim().toUpperCase();
  if (userData.departmentId) cleanedData.departmentId = userData.departmentId;

  let savedUser;
  try {
    if (isReRegistration && existingUser) {
      existingUser.name = cleanedData.name;
      existingUser.email = cleanedData.email;
      existingUser.hostelId = cleanedData.hostelId;
      existingUser.blockId = cleanedData.blockId;
      existingUser.floorId = cleanedData.floorId;
      existingUser.roomId = cleanedData.roomId;
      existingUser.roomNumber = cleanedData.roomNumber;
      if (cleanedData.phone) existingUser.phone = cleanedData.phone;
      if (cleanedData.studentId) existingUser.studentId = cleanedData.studentId;
      await existingUser.save();
      savedUser = existingUser;
    } else {
      savedUser = await User.create(cleanedData);
    }
  } catch (err) {
    // Rollback room occupancy increment if user save fails
    await Room.findByIdAndUpdate(room._id, { $inc: { currentOccupancy: -1 } });
    throw err;
  }

  const safeUser = sanitizeUser(savedUser);
  if (!safeUser.roomNumber) safeUser.roomNumber = typedRoomNumber;
  const token = signToken({ userId: savedUser._id, role: savedUser.role });

  return { user: safeUser, token, isReRegistration };
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

/**
 * Self-service password change (DEC-022).
 * Verifies the current password, stores the new hash, clears any forced-change
 * flag and stamps `passwordChangedAt` so every older token is revoked. Returns a
 * fresh token because the caller's own previous token is revoked too.
 *
 * A wrong current password is a 400, not a 401: the frontend treats 401 as
 * "session expired" and would otherwise log the user out for a typo.
 */
export const changePassword = async (userId, { currentPassword, newPassword }, req = null) => {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user || !user.isActive) {
    throw ApiError.unauthorized('Account not found or inactive.');
  }

  const currentIsValid = await comparePassword(currentPassword, user.passwordHash);
  if (!currentIsValid) {
    await logSecurityEvent({
      eventType: SECURITY_EVENT_TYPES.FAILED_LOGIN,
      severity: SECURITY_SEVERITIES.MEDIUM,
      actorId: user._id,
      actorRole: user.role,
      actorEmail: user.email,
      hostelId: user.hostelId,
      req,
      details: { reason: 'Incorrect current password on change-password' },
    });
    throw ApiError.badRequest('Current password is incorrect.');
  }

  if (await comparePassword(newPassword, user.passwordHash)) {
    throw ApiError.badRequest('New password must be different from the current password.');
  }

  user.passwordHash = await hashPassword(newPassword);
  user.passwordChangedAt = new Date();
  user.mustChangePassword = false;
  await user.save();

  await logSecurityEvent({
    eventType: SECURITY_EVENT_TYPES.PASSWORD_CHANGED,
    severity: SECURITY_SEVERITIES.LOW,
    actorId: user._id,
    actorRole: user.role,
    actorEmail: user.email,
    targetEntity: 'User',
    targetEntityId: user._id,
    hostelId: user.hostelId,
    req,
    details: { reason: 'Self-service password change' },
  });

  return {
    user: sanitizeUser(user),
    token: signToken({ userId: user._id, role: user.role }),
  };
};

// Roles a WARDEN may reset, and only inside the warden's own hostel (DEC-022)
const WARDEN_RESETTABLE_ROLES = [ROLES.STUDENT, ROLES.HOSTEL_STAFF];

/**
 * Admin or warden initiated password reset (DEC-022).
 *
 * - SUPER_ADMIN may reset any other account.
 * - WARDEN may reset STUDENT and HOSTEL_STAFF accounts of their own hostel only.
 * - Nobody resets their own password here (use changePassword).
 *
 * A random temporary password is generated, the target is forced to change it on
 * next login, and all of the target's existing sessions are revoked. The temporary
 * password is returned to the caller exactly once and is never written to the audit
 * log or the application log.
 */
export const resetUserPassword = async (actor, targetId, req = null) => {
  if (!mongoose.isValidObjectId(targetId)) {
    throw ApiError.notFound('User not found.');
  }
  if (String(actor._id) === String(targetId)) {
    throw ApiError.badRequest('You cannot reset your own password here. Use Change Password instead.');
  }

  const target = await User.findById(targetId);
  if (!target) {
    throw ApiError.notFound('User not found.');
  }

  if (actor.role === ROLES.WARDEN) {
    if (!WARDEN_RESETTABLE_ROLES.includes(target.role)) {
      await logSecurityEvent({
        eventType: SECURITY_EVENT_TYPES.PRIVILEGE_ESCALATION_ATTEMPT,
        severity: SECURITY_SEVERITIES.HIGH,
        targetEntity: 'User',
        targetEntityId: target._id,
        hostelId: actor.hostelId,
        req,
        details: { reason: 'Warden attempted to reset a password outside student and staff roles', targetRole: target.role },
      });
      throw ApiError.forbidden('Wardens can only reset student and hostel staff passwords.');
    }
    if (!actor.hostelId || String(target.hostelId) !== String(actor.hostelId)) {
      await logSecurityEvent({
        eventType: SECURITY_EVENT_TYPES.CROSS_HOSTEL_ACCESS_ATTEMPT,
        severity: SECURITY_SEVERITIES.HIGH,
        targetEntity: 'User',
        targetEntityId: target._id,
        hostelId: actor.hostelId,
        req,
        details: { reason: 'Warden attempted to reset a password for a user outside their hostel' },
      });
      throw ApiError.forbidden('You can only reset passwords for users of your own hostel.');
    }
  } else if (actor.role !== ROLES.SUPER_ADMIN) {
    throw ApiError.forbidden('You are not allowed to reset passwords.');
  }

  if (!target.isActive) {
    throw ApiError.badRequest('This account is deactivated. Reactivate it before resetting the password.');
  }

  const temporaryPassword = generateTemporaryPassword();
  target.passwordHash = await hashPassword(temporaryPassword);
  target.passwordChangedAt = new Date();
  target.mustChangePassword = true;
  await target.save();

  await logSecurityEvent({
    eventType: SECURITY_EVENT_TYPES.PASSWORD_RESET,
    severity: SECURITY_SEVERITIES.MEDIUM,
    targetEntity: 'User',
    targetEntityId: target._id,
    hostelId: target.hostelId,
    req,
    details: {
      reason: 'Password reset by authorized user',
      targetEmail: target.email,
      targetRole: target.role,
    },
  });

  return { user: sanitizeUser(target), temporaryPassword };
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Users a WARDEN may manage (DEC-022): STUDENT and HOSTEL_STAFF of the warden's own
 * hostel. Exists so wardens can find whom to reset without needing the SUPER_ADMIN
 * user list. Returns the safe user shape only, capped at 100 rows.
 */
export const listHostelUsers = async (actor, { search, role } = {}) => {
  if (!actor.hostelId) {
    throw ApiError.forbidden('Your account is not assigned to a hostel.');
  }

  const filter = {
    hostelId: actor.hostelId,
    role: { $in: WARDEN_RESETTABLE_ROLES },
  };
  if (role && WARDEN_RESETTABLE_ROLES.includes(role)) {
    filter.role = role;
  }

  const term = typeof search === 'string' ? search.trim().slice(0, 80) : '';
  if (term) {
    const pattern = new RegExp(escapeRegex(term), 'i');
    filter.$or = [{ name: pattern }, { email: pattern }, { studentId: pattern }, { employeeId: pattern }];
  }

  const [users, total] = await Promise.all([
    User.find(filter).populate('roomId', 'roomNumber').sort({ name: 1 }).limit(100),
    User.countDocuments(filter),
  ]);

  return { users: users.map(sanitizeUser), total };
};
