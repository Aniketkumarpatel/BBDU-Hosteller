import ApiError from '../utils/ApiError.js';
import { logSecurityEvent } from '../services/securityAudit.service.js';
import {
  SECURITY_EVENT_TYPES,
  SECURITY_SEVERITIES,
} from '../models/SecurityAuditLog.js';

/**
 * Express middleware that validates req.body against a Zod schema.
 * Formats validation issues cleanly and passes an ApiError.badRequest to errorHandler.
 * Handles both Zod 3 (result.error.errors) and Zod 4 (result.error.issues).
 *
 * @param {import('zod').ZodSchema} schema
 */
export const validate = (schema) => async (req, _res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const issues = result.error.issues || result.error.errors || [];
    const details = issues.map((err) => ({
      field: Array.isArray(err.path) ? err.path.join('.') : String(err.path || ''),
      message: err.message,
    }));

    // If validation failed on privilege escalation attempt (e.g. attempting non-student role on register)
    if (req.body && req.body.role && req.body.role !== 'STUDENT') {
      try {
        await logSecurityEvent({
          eventType: SECURITY_EVENT_TYPES.PRIVILEGE_ESCALATION_ATTEMPT,
          severity: SECURITY_SEVERITIES.HIGH,
          actorEmail: req.body.email ? String(req.body.email).toLowerCase() : '',
          req,
          details: {
            attemptedRole: req.body.role,
            reason: 'Role validation rejected escalation attempt on public registration',
          },
        });
      } catch (logErr) {
        // Continue even if audit fails
      }
    }

    const message = details.length === 1 ? details[0].message : 'Validation failed';
    return next(ApiError.badRequest(message, details));
  }
  // Replace req.body with parsed/sanitized data (applies defaults and transforms)
  req.body = result.data;
  next();
};

export default validate;
