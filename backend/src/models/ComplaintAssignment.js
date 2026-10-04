import mongoose from 'mongoose';
import { ASSIGNMENT_TYPE_VALUES, ASSIGNMENT_TYPES } from '../constants/complaint.constants.js';

const complaintAssignmentSchema = new mongoose.Schema(
  {
    complaintId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Complaint',
      required: [true, 'Complaint reference is required'],
      index: true,
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Assigned by user reference is required'],
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Assigned to user reference is required'],
      index: true,
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: [true, 'Department reference is required'],
      index: true,
    },
    previousAssignee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    assignmentType: {
      type: String,
      enum: {
        values: ASSIGNMENT_TYPE_VALUES,
        message: 'Invalid assignment type',
      },
      default: ASSIGNMENT_TYPES.MANUAL,
    },
    reason: {
      type: String,
      trim: true,
      maxlength: [500, 'Reason cannot exceed 500 characters'],
      default: '',
    },
    assignedAt: {
      type: Date,
      default: Date.now,
    },
    acknowledgedAt: {
      type: Date,
      default: null,
    },
    unassignedAt: {
      type: Date,
      default: null,
    },
    isCurrent: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for history tracking & current assignee lookup
complaintAssignmentSchema.index({ complaintId: 1, isCurrent: 1 });
complaintAssignmentSchema.index({ assignedTo: 1, isCurrent: 1 });
complaintAssignmentSchema.index({ complaintId: 1, assignedAt: -1 });

const ComplaintAssignment =
  mongoose.models.ComplaintAssignment ||
  mongoose.model('ComplaintAssignment', complaintAssignmentSchema);

export default ComplaintAssignment;
