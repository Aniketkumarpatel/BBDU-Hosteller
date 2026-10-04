import mongoose from 'mongoose';
import {
  COMPLAINT_CATEGORY_VALUES,
  COMPLAINT_PRIORITY_VALUES,
  COMPLAINT_STATUSES,
  COMPLAINT_STATUS_VALUES,
  ALL_ISSUE_TYPES,
} from '../constants/complaint.constants.js';
import { SLA_STATUS_VALUES } from '../constants/sla.constants.js';

const complaintSchema = new mongoose.Schema(
  {
    complaintId: {
      type: String,
      required: [true, 'Complaint ID is required'],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Complaint title is required'],
      trim: true,
      minlength: [3, 'Title must be at least 3 characters'],
      maxlength: [120, 'Title cannot exceed 120 characters'],
    },
    description: {
      type: String,
      required: [true, 'Complaint description is required'],
      trim: true,
      minlength: [10, 'Description must be at least 10 characters'],
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: {
        values: COMPLAINT_CATEGORY_VALUES,
        message: 'Invalid complaint category',
      },
      index: true,
    },
    issueType: {
      type: String,
      required: [true, 'Issue type is required'],
      enum: {
        values: ALL_ISSUE_TYPES,
        message: 'Invalid issue type',
      },
    },
    priority: {
      type: String,
      required: [true, 'Priority is required'],
      enum: {
        values: COMPLAINT_PRIORITY_VALUES,
        message: 'Invalid priority level',
      },
      default: 'MEDIUM',
      index: true,
    },
    status: {
      type: String,
      required: [true, 'Status is required'],
      enum: {
        values: COMPLAINT_STATUS_VALUES,
        message: 'Invalid complaint status',
      },
      default: COMPLAINT_STATUSES.SUBMITTED,
      index: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Student reference is required'],
      index: true,
    },
    hostelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hostel',
      required: [true, 'Hostel reference is required'],
      index: true,
    },
    blockId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Block',
      required: [true, 'Block reference is required'],
    },
    floorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Floor',
      required: [true, 'Floor reference is required'],
    },
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: [true, 'Room reference is required'],
      index: true,
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
    },
    messId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Mess',
      default: null,
      index: true,
    },
    mealType: {
      type: String,
      default: null,
    },
    mealDate: {
      type: Date,
      default: null,
    },
    cleaningAreaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CleaningArea',
      default: null,
      index: true,
    },
    cleaningPlanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CleaningPlan',
      default: null,
      index: true,
    },
    cleaningTaskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CleaningTask',
      default: null,
      index: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    locationDescription: {
      type: String,
      trim: true,
      maxlength: [200, 'Location description cannot exceed 200 characters'],
      default: '',
    },
    triageNote: {
      type: String,
      trim: true,
      maxlength: [1000, 'Triage note cannot exceed 1000 characters'],
      default: '',
    },
    triagedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    triagedAt: {
      type: Date,
      default: null,
    },
    assignedAt: {
      type: Date,
      default: null,
    },
    acknowledgedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    acknowledgedAt: {
      type: Date,
      default: null,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
    resolutionNote: {
      type: String,
      trim: true,
      maxlength: [2000, 'Resolution note cannot exceed 2000 characters'],
      default: '',
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    verificationRequestedAt: {
      type: Date,
      default: null,
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    verificationNote: {
      type: String,
      trim: true,
      maxlength: [1000, 'Verification note cannot exceed 1000 characters'],
      default: '',
    },
    reopenedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reopenedAt: {
      type: Date,
      default: null,
    },
    reopenReason: {
      type: String,
      trim: true,
      maxlength: [1000, 'Reopen reason cannot exceed 1000 characters'],
      default: '',
    },
    reopenCount: {
      type: Number,
      default: 0,
    },
    closedAt: {
      type: Date,
      default: null,
    },
    // SLA Snapshot & Monitoring Fields
    slaRuleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SlaRule',
      default: null,
    },
    slaStatus: {
      type: String,
      enum: {
        values: [...SLA_STATUS_VALUES, null],
        message: 'Invalid SLA status',
      },
      default: null,
      index: true,
    },
    slaStartedAt: {
      type: Date,
      default: null,
    },
    slaDueAt: {
      type: Date,
      default: null,
      index: true,
    },
    slaBreachedAt: {
      type: Date,
      default: null,
    },
    currentEscalationLevel: {
      type: Number,
      default: 0,
      index: true,
    },
    reminderSentAt: {
      type: Date,
      default: null,
    },
    escalationCount: {
      type: Number,
      default: 0,
    },
    slaCompletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
complaintSchema.index({ studentId: 1, createdAt: -1 });
complaintSchema.index({ hostelId: 1, status: 1 });
complaintSchema.index({ category: 1, status: 1 });
complaintSchema.index({ slaStatus: 1, slaDueAt: 1 });
complaintSchema.index({ status: 1, slaStatus: 1 });

const Complaint = mongoose.models.Complaint || mongoose.model('Complaint', complaintSchema);
export default Complaint;
