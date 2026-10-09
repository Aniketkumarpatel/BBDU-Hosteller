import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import { verifyToken } from '../utils/jwt.js';
import { logSecurityEvent } from '../services/securityAudit.service.js';
import {
  SECURITY_EVENT_TYPES,
  SECURITY_SEVERITIES,
} from '../models/SecurityAuditLog.js';

/**
 * Middleware: requireAuth
 *
 * 1. Reads Authorization header: "Bearer <token>"
 * 2. Verifies JWT
 * 3. Finds user by decoded userId
 * 4. Checks user exists
 * 5. Checks user isActive
 * 6. Rejects tokens issued before the user's last password change (session revocation)
 * 7. Rejects every route except the allow-listed ones while a password change is
 *    pending (`mustChangePassword`), enforced here so it cannot be bypassed by
 *    calling the API directly
 * 8. Attaches safe user object to req.user
 * 9. Rejects invalid / expired tokens with 401 Unauthorized
 */
const buildAuthenticator = (allowPendingPasswordChange) => async (req, _res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw ApiError.unauthorized('Authentication required. Missing Bearer token.');
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      throw ApiError.unauthorized('Authentication required. Invalid token format.');
    }

    const decoded = verifyToken(token);

    const user = await User.findById(decoded.userId);
    if (!user) {
      throw ApiError.unauthorized('Account associated with this token no longer exists.');
    }

    if (!user.isActive) {
      logSecurityEvent({
        eventType: SECURITY_EVENT_TYPES.ACCOUNT_DEACTIVATION,
        severity: SECURITY_SEVERITIES.HIGH,
        actorId: user._id,
        actorRole: user.role,
        actorEmail: user.email,
        req,
        details: { reason: 'Deactivated user attempted API access' },
      });
      throw ApiError.forbidden('Your account is deactivated. Access denied.');
    }

    // JWT `iat` has one-second precision, so compare whole seconds. A token issued in
    // the same second as the password change (e.g. the fresh one returned by
    // change-password) is accepted; anything issued earlier is revoked.
    if (user.passwordChangedAt) {
      const changedAtSeconds = Math.floor(user.passwordChangedAt.getTime() / 1000);
      if (!decoded.iat || decoded.iat < changedAtSeconds) {
        throw ApiError.unauthorized('Your password was changed. Please log in again.');
      }
    }

    if (user.mustChangePassword && !allowPendingPasswordChange) {
      throw new ApiError(
        403,
        'You must change your temporary password before using the system.',
        { code: 'PASSWORD_CHANGE_REQUIRED' }
      );
    }

    req.user = user;
    req.tokenPayload = decoded;
    next();
  } catch (err) {
    next(err);
  }
};

export const requireAuth = buildAuthenticator(false);

/**
 * Same as requireAuth, but also lets a user with a pending forced password change
 * through. Use ONLY on /auth/me and /auth/change-password.
 */
export const requireAuthAllowPasswordChange = buildAuthenticator(true);

/**
 * Middleware: requireRole(...allowedRoles)
 *
 * Checks whether the authenticated user has one of the required roles.
 * Must be preceded by requireAuth in the middleware chain.
 *
 * @param  {...string} allowedRoles Roles allowed to access the route
 */
export const requireRole = (...allowedRoles) => async (req, _res, next) => {
  if (!req.user) {
    return next(ApiError.unauthorized('Authentication required prior to role verification.'));
  }

  if (!allowedRoles.includes(req.user.role)) {
    try {
      await logSecurityEvent({
        eventType: SECURITY_EVENT_TYPES.UNAUTHORIZED_ACCESS_ATTEMPT,
        severity: SECURITY_SEVERITIES.HIGH,
        actorId: req.user._id,
        actorRole: req.user.role,
        actorEmail: req.user.email,
        targetEntity: req.originalUrl || req.baseUrl,
        req,
        details: {
          method: req.method,
          requiredRoles: allowedRoles,
          userRole: req.user.role,
        },
      });
    } catch (_e) {
      // Continue even if logging fails
    }

    return next(
      ApiError.forbidden(
        `Forbidden: Role '${req.user.role}' lacks permission. Required role(s): ${allowedRoles.join(', ')}.`
      )
    );
  }

  next();
};
