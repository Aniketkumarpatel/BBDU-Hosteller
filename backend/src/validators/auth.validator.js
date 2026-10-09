import { z } from 'zod';
import { ROLES, ROLE_VALUES } from '../constants/roles.js';

// Public self-registration only allows the STUDENT role (or HOSTEL_STAFF if configured, but default is STUDENT).
// SUPER_ADMIN, AUTHORITY, and WARDEN can NEVER be registered through public endpoints.
const PUBLIC_ALLOWED_ROLES = [ROLES.STUDENT];

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

/**
 * Single password policy used by registration, change-password, reset and the admin
 * user form, so no entry point can accept a weaker password than the others.
 */
export const passwordPolicySchema = z
  .string({ required_error: 'Password is required' })
  .min(8, 'Password must be at least 8 characters long')
  .max(128, 'Password cannot exceed 128 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string({ required_error: 'Current password is required' })
      .min(1, 'Current password is required')
      .max(128, 'Current password cannot exceed 128 characters'),
    newPassword: passwordPolicySchema,
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'New password must be different from the current password',
    path: ['newPassword'],
  });

export const registerSchema = z.object({
  name: z
    .string({ required_error: 'Name is required' })
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(120, 'Name cannot exceed 120 characters'),
  email: z
    .string({ required_error: 'Email is required' })
    .trim()
    .toLowerCase()
    .email('Please provide a valid email address')
    .max(254, 'Email cannot exceed 254 characters')
    .refine((val) => val.trim().toLowerCase().endsWith('@bbdu.ac.in'), {
      message: 'Please use your official BBDU email address ending with @bbdu.ac.in.',
    }),
  password: passwordPolicySchema,
  role: z
    .enum(ROLE_VALUES, {
      errorMap: () => ({ message: `Role must be one of: ${ROLE_VALUES.join(', ')}` }),
    })
    .default(ROLES.STUDENT)
    .refine(
      (role) => PUBLIC_ALLOWED_ROLES.includes(role),
      {
        message: 'Public self-registration is restricted to STUDENT accounts. Administrative roles must be provisioned by a SUPER_ADMIN.',
      }
    ),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9]{7,15}$/, 'Phone number must contain between 7 and 15 digits')
    .optional()
    .or(z.literal('')),
  studentId: z.string().trim().max(50).optional().or(z.literal('')),
  employeeId: z.string().trim().max(50).optional().or(z.literal('')),
  hostelId: z.preprocess(
    (val) => (val === undefined || val === null ? '' : String(val)),
    z.string().trim().min(1, 'Hostel Name is required.').regex(objectIdRegex, 'Hostel Name is required.')
  ),
  blockId: z.preprocess(
    (val) => (val === undefined || val === null ? '' : String(val)),
    z.string().trim().min(1, 'Block/Wing is required.').regex(objectIdRegex, 'Block/Wing is required.')
  ),
  floorId: z.preprocess(
    (val) => (val === undefined || val === null ? '' : String(val)),
    z.string().trim().min(1, 'Floor is required.').regex(objectIdRegex, 'Floor is required.')
  ),
  roomNumber: z.preprocess(
    (val) => (val !== undefined && val !== null && String(val).trim() !== '' ? String(val).trim() : undefined),
    z.string().optional()
  ),
  roomId: z.preprocess(
    (val) => (val !== undefined && val !== null && String(val).trim() !== '' ? String(val).trim() : undefined),
    z.string().optional()
  ),
  departmentId: z.string().regex(objectIdRegex, 'Invalid department ID format').optional().or(z.literal('')),
}).refine((data) => Boolean(data.roomNumber || data.roomId), {
  message: 'Room Number is required.',
  path: ['roomNumber'],
});

export const loginSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .trim()
    .toLowerCase()
    .email('Please provide a valid email address'),
  password: z
    .string({ required_error: 'Password is required' })
    .min(1, 'Password is required'),
});
