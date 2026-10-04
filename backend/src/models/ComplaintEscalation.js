import mongoose from 'mongoose';
import { ESCALATION_TRIGGER_VALUES, ESCALATION_TRIGGERS } from '../constants/sla.constants.js';

const complaintEscalationSchema = new mongoose.Schema(
  {
    complaintId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Complaint',
      required: [true, 'Complaint reference is required'],
      index: true,
    },
    fromUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    toUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Target escalated user reference is required'],
      index: true,
    },
    fromRole: {
      type: String,
      required: [true, 'fromRole is required'],
    },
    toRole: {
      type: String,
      required: [true, 'toRole is required'],
    },
    previousAssignmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ComplaintAssignment',
      default: null,
    },
    newAssignmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ComplaintAssignment',
      default: null,
    },
    escalationLevel: {
      type: Number,
      required: true,
      default: 1,
    },
    reason: {
      type: String,
      required: [true, 'Escalation reason is required'],
      trim: true,
      maxlength: [1000, 'Reason cannot exceed 1000 characters'],
    },
    triggeredBy: {
      type: String,
      enum: ESCALATION_TRIGGER_VALUES,
      default: ESCALATION_TRIGGERS.SYSTEM,
    },
    triggeredAt: {
      type: Date,
      default: Date.now,
    },
    slaBreachedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

complaintEscalationSchema.index({ complaintId: 1, escalationLevel: 1 });
complaintEscalationSchema.index({ complaintId: 1, triggeredAt: -1 });

const ComplaintEscalation =
  mongoose.models.ComplaintEscalation ||
  mongoose.model('ComplaintEscalation', complaintEscalationSchema);

export default ComplaintEscalation;
