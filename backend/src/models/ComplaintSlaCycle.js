import mongoose from 'mongoose';
import { SLA_STATUS_VALUES, SLA_STATUSES } from '../constants/sla.constants.js';

const complaintSlaCycleSchema = new mongoose.Schema(
  {
    complaintId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Complaint',
      required: [true, 'Complaint reference is required'],
      index: true,
    },
    cycleNumber: {
      type: Number,
      required: true,
      default: 1,
    },
    escalationLevel: {
      type: Number,
      required: true,
      default: 0,
      index: true,
    },
    slaRuleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SlaRule',
      default: null,
    },
    slaRuleSnapshot: {
      name: { type: String, default: '' },
      code: { type: String, default: '' },
      priority: { type: String, default: '' },
      resolutionHours: { type: Number, default: 24 },
      reminderThresholdPercent: { type: Number, default: 75 },
    },
    startedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    dueAt: {
      type: Date,
      required: true,
      index: true,
    },
    reminderDueAt: {
      type: Date,
      default: null,
    },
    reminderSentAt: {
      type: Date,
      default: null,
    },
    breachedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: {
        values: SLA_STATUS_VALUES,
        message: 'Invalid SLA cycle status',
      },
      default: SLA_STATUSES.ACTIVE,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

complaintSlaCycleSchema.index({ complaintId: 1, cycleNumber: 1 });
complaintSlaCycleSchema.index({ status: 1, dueAt: 1 });

const ComplaintSlaCycle =
  mongoose.models.ComplaintSlaCycle ||
  mongoose.model('ComplaintSlaCycle', complaintSlaCycleSchema);

export default ComplaintSlaCycle;
