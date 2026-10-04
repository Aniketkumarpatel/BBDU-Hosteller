import mongoose from 'mongoose';

export const SECURITY_EVENT_TYPES = Object.freeze({
  FAILED_LOGIN: 'FAILED_LOGIN',
  UNAUTHORIZED_ACCESS_ATTEMPT: 'UNAUTHORIZED_ACCESS_ATTEMPT',
  PRIVILEGE_ESCALATION_ATTEMPT: 'PRIVILEGE_ESCALATION_ATTEMPT',
  CROSS_HOSTEL_ACCESS_ATTEMPT: 'CROSS_HOSTEL_ACCESS_ATTEMPT',
  SUSPICIOUS_REQUEST: 'SUSPICIOUS_REQUEST',
  SENSITIVE_DATA_MUTATION: 'SENSITIVE_DATA_MUTATION',
  ROLE_CHANGE: 'ROLE_CHANGE',
  ACCOUNT_DEACTIVATION: 'ACCOUNT_DEACTIVATION',
  DESTRUCTIVE_ACTION: 'DESTRUCTIVE_ACTION',
});

export const SECURITY_EVENT_TYPE_VALUES = Object.freeze(Object.values(SECURITY_EVENT_TYPES));

export const SECURITY_SEVERITIES = Object.freeze({
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
});

export const SECURITY_SEVERITY_VALUES = Object.freeze(Object.values(SECURITY_SEVERITIES));

const securityAuditLogSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      required: [true, 'Event ID is required'],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    eventType: {
      type: String,
      required: [true, 'Event type is required'],
      enum: SECURITY_EVENT_TYPE_VALUES,
      index: true,
    },
    severity: {
      type: String,
      enum: SECURITY_SEVERITY_VALUES,
      default: SECURITY_SEVERITIES.MEDIUM,
      index: true,
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    actorRole: {
      type: String,
      default: 'ANONYMOUS',
    },
    actorEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
    },
    targetEntity: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    targetEntityId: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    hostelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hostel',
      default: null,
      index: true,
    },
    ipAddress: {
      type: String,
      trim: true,
      default: '',
    },
    userAgent: {
      type: String,
      trim: true,
      default: '',
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    createdAt: {
      type: Date,
      default: Date.now,
      immutable: true,
      index: true,
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

securityAuditLogSchema.index({ eventType: 1, createdAt: -1 });
securityAuditLogSchema.index({ actorId: 1, createdAt: -1 });
securityAuditLogSchema.index({ hostelId: 1, createdAt: -1 });

const SecurityAuditLog =
  mongoose.models.SecurityAuditLog ||
  mongoose.model('SecurityAuditLog', securityAuditLogSchema, 'security_audit_logs');

export default SecurityAuditLog;
