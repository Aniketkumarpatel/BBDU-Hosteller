import SecurityAuditLog, {
  SECURITY_EVENT_TYPES,
  SECURITY_SEVERITIES,
} from '../models/SecurityAuditLog.js';
import Counter, { getNextSequence } from '../models/Counter.js';
import ApiError from '../utils/ApiError.js';
import { ROLES } from '../constants/roles.js';

export const generateSecurityEventId = async () => {
  const year = new Date().getFullYear();
  const seq = await getNextSequence(`security_audit_${year}`);
  return `AUD-${year}-${String(seq).padStart(5, '0')}`;
};

/**
 * Strips sensitive fields like passwords, hashes, tokens from metadata
 */
const sanitizeAuditDetails = (details = {}) => {
  if (!details || typeof details !== 'object') return {};
  const cleaned = { ...details };
  const sensitiveKeys = [
    'password',
    'passwordHash',
    'token',
    'jwt',
    'secret',
    'authorization',
    'cookie',
  ];

  for (const key of Object.keys(cleaned)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some((s) => lowerKey.includes(s))) {
      cleaned[key] = '[REDACTED]';
    } else if (typeof cleaned[key] === 'object' && cleaned[key] !== null) {
      cleaned[key] = sanitizeAuditDetails(cleaned[key]);
    }
  }

  return cleaned;
};

/**
 * Logs a structured security audit event asynchronously.
 * Never throws an uncaught error that would interrupt main application flow.
 */
export const logSecurityEvent = async ({
  eventType = SECURITY_EVENT_TYPES.SUSPICIOUS_REQUEST,
  severity = SECURITY_SEVERITIES.MEDIUM,
  actorId = null,
  actorRole = 'ANONYMOUS',
  actorEmail = '',
  targetEntity = '',
  targetEntityId = '',
  hostelId = null,
  req = null,
  details = {},
}) => {
  try {
    const eventId = await generateSecurityEventId();

    let ipAddress = '';
    let userAgent = '';

    if (req) {
      ipAddress =
        req.ip ||
        req.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ||
        req.socket?.remoteAddress ||
        '';
      userAgent = req.headers?.['user-agent'] || '';

      if (!actorId && req.user) {
        actorId = req.user._id;
        actorRole = req.user.role;
        actorEmail = req.user.email;
      }
    }

    const safeDetails = sanitizeAuditDetails(details);

    const logEntry = await SecurityAuditLog.create({
      eventId,
      eventType,
      severity,
      actorId: actorId || null,
      actorRole: actorRole || 'ANONYMOUS',
      actorEmail: actorEmail || '',
      targetEntity: String(targetEntity || ''),
      targetEntityId: String(targetEntityId || ''),
      hostelId: hostelId || null,
      ipAddress,
      userAgent,
      details: safeDetails,
      createdAt: new Date(),
    });

    return logEntry;
  } catch (err) {
    console.error('[securityAudit] Failed to record security event:', err.message);
    return null;
  }
};

/**
 * Retrieve security audit logs with pagination and filters
 * Restricted to SUPER_ADMIN and AUTHORITY
 */
export const getSecurityAuditLogs = async (query = {}, currentUser) => {
  if (![ROLES.SUPER_ADMIN, ROLES.AUTHORITY].includes(currentUser.role)) {
    throw ApiError.forbidden('Only university administrators can inspect security audit records');
  }

  const {
    eventType,
    severity,
    actorId,
    hostelId,
    search,
    startDate,
    endDate,
    page = 1,
    limit = 50,
  } = query;

  const mongoQuery = {};

  if (eventType) mongoQuery.eventType = eventType;
  if (severity) mongoQuery.severity = severity;
  if (actorId) mongoQuery.actorId = actorId;
  if (hostelId) mongoQuery.hostelId = hostelId;

  if (startDate || endDate) {
    mongoQuery.createdAt = {};
    if (startDate) mongoQuery.createdAt.$gte = new Date(startDate);
    if (endDate) mongoQuery.createdAt.$lte = new Date(endDate);
  }

  if (search) {
    const sRegex = new RegExp(search.trim(), 'i');
    mongoQuery.$or = [
      { eventId: sRegex },
      { actorEmail: sRegex },
      { targetEntity: sRegex },
      { ipAddress: sRegex },
    ];
  }

  const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);

  const [logs, total] = await Promise.all([
    SecurityAuditLog.find(mongoQuery)
      .populate('actorId', 'name email role')
      .populate('hostelId', 'name code')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10))
      .lean(),
    SecurityAuditLog.countDocuments(mongoQuery),
  ]);

  return {
    logs,
    total,
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    totalPages: Math.ceil(total / parseInt(limit, 10)) || 1,
  };
};

/**
 * Get aggregate security intelligence stats
 */
export const getSecurityStats = async (currentUser) => {
  if (![ROLES.SUPER_ADMIN, ROLES.AUTHORITY].includes(currentUser.role)) {
    throw ApiError.forbidden('Only university administrators can view security metrics');
  }

  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [totalEvents, last24hCount, severityAgg, typeAgg] = await Promise.all([
    SecurityAuditLog.countDocuments(),
    SecurityAuditLog.countDocuments({ createdAt: { $gte: last24h } }),
    SecurityAuditLog.aggregate([
      { $group: { _id: '$severity', count: { $sum: 1 } } },
    ]),
    SecurityAuditLog.aggregate([
      { $group: { _id: '$eventType', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
  ]);

  const severityCounts = {};
  severityAgg.forEach((s) => {
    severityCounts[s._id] = s.count;
  });

  return {
    totalEvents,
    last24hCount,
    severityCounts,
    topEventTypes: typeAgg.map((t) => ({ eventType: t._id, count: t.count })),
  };
};
