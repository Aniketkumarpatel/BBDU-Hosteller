import mongoose from 'mongoose';
import {
  CLEANING_TYPE_VALUES,
  CLEANING_PRIORITY_VALUES,
  CLEANING_TASK_STATUSES,
  CLEANING_TASK_STATUS_VALUES,
} from '../constants/cleaning.constants.js';

const cleaningTaskChecklistSchema = new mongoose.Schema(
  {
    item: {
      type: String,
      required: true,
      trim: true,
    },
    isCompleted: {
      type: Boolean,
      default: false,
    },
    note: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { _id: false }
);

const cleaningTaskAuditLogSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    previousStatus: {
      type: String,
      default: null,
    },
    newStatus: {
      type: String,
      default: null,
    },
    note: {
      type: String,
      default: '',
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const cleaningTaskSchema = new mongoose.Schema(
  {
    taskId: {
      type: String,
      required: [true, 'Task ID is required'],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    cleaningPlanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CleaningPlan',
      default: null,
      index: true,
    },
    cleaningAreaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CleaningArea',
      required: [true, 'Cleaning Area is required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Task title is required'],
      trim: true,
      maxlength: [150, 'Title cannot exceed 150 characters'],
    },
    cleaningType: {
      type: String,
      required: [true, 'Cleaning type is required'],
      enum: {
        values: CLEANING_TYPE_VALUES,
        message: 'Invalid cleaning type',
      },
      default: 'ROUTINE',
    },
    priority: {
      type: String,
      enum: {
        values: CLEANING_PRIORITY_VALUES,
        message: 'Invalid priority level',
      },
      default: 'MEDIUM',
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
      default: null,
      index: true,
    },
    floorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Floor',
      default: null,
      index: true,
    },
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      default: null,
      index: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    assignedAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      required: [true, 'Status is required'],
      enum: {
        values: CLEANING_TASK_STATUS_VALUES,
        message: 'Invalid task status',
      },
      default: CLEANING_TASK_STATUSES.CREATED,
      index: true,
    },
    scheduledDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    dueAt: {
      type: Date,
      required: true,
      index: true,
    },
    acceptedAt: {
      type: Date,
      default: null,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    qualityScore: {
      type: Number,
      min: 1,
      max: 5,
      default: null,
    },
    verificationNote: {
      type: String,
      trim: true,
      maxlength: [500, 'Verification note cannot exceed 500 characters'],
      default: '',
    },
    completionNote: {
      type: String,
      trim: true,
      maxlength: [500, 'Completion note cannot exceed 500 characters'],
      default: '',
    },
    rejectionReason: {
      type: String,
      trim: true,
      maxlength: [500, 'Rejection reason cannot exceed 500 characters'],
      default: '',
    },
    checklist: [cleaningTaskChecklistSchema],
    isOverdue: {
      type: Boolean,
      default: false,
      index: true,
    },
    isMissed: {
      type: Boolean,
      default: false,
      index: true,
    },
    complaintId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Complaint',
      default: null,
      index: true,
    },
    auditLog: [cleaningTaskAuditLogSchema],
  },
  {
    timestamps: true,
  }
);

cleaningTaskSchema.index({ hostelId: 1, status: 1, scheduledDate: 1 });
cleaningTaskSchema.index({ assignedTo: 1, status: 1 });

const CleaningTask =
  mongoose.models.CleaningTask || mongoose.model('CleaningTask', cleaningTaskSchema);

export default CleaningTask;
