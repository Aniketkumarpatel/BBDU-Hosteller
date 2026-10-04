import { z } from 'zod';
import { ROLES, ROLE_VALUES } from '../constants/roles.js';

// Public self-registration only allows the STUDENT role (or HOSTEL_STAFF if configured, but default is STUDENT).
// SUPER_ADMIN, AUTHORITY, and WARDEN can NEVER be registered through public endpoints.
const PUBLIC_ALLOWED_ROLES = [ROLES.STUDENT];

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

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
    .max(254, 'Email cannot exceed 254 characters'),
  password: z
    .string({ required_error: 'Password is required' })
    .min(8, 'Password must be at least 8 characters long')
    .max(128, 'Password cannot exceed 128 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
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
  hostelId: z.string().regex(objectIdRegex, 'Invalid hostel ID format').optional().or(z.literal('')),
  blockId: z.string().regex(objectIdRegex, 'Invalid block ID format').optional().or(z.literal('')),
  floorId: z.string().regex(objectIdRegex, 'Invalid floor ID format').optional().or(z.literal('')),
  roomId: z.string().regex(objectIdRegex, 'Invalid room ID format').optional().or(z.literal('')),
  departmentId: z.string().regex(objectIdRegex, 'Invalid department ID format').optional().or(z.literal('')),
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
