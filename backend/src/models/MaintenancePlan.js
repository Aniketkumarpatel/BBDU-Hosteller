import mongoose from 'mongoose';
import {
  MAINTENANCE_TYPES,
  MAINTENANCE_TYPE_VALUES,
  FREQUENCY_UNITS,
  FREQUENCY_UNIT_VALUES,
  MAINTENANCE_PLAN_STATUSES,
  MAINTENANCE_PLAN_STATUS_VALUES,
} from '../constants/preventiveMaintenance.constants.js';
import {
  WORK_ORDER_PRIORITIES,
  WORK_ORDER_PRIORITY_VALUES,
} from '../constants/workOrder.constants.js';

const planAuditSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      trim: true,
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
      trim: true,
      default: '',
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const maintenancePlanSchema = new mongoose.Schema(
  {
    planId: {
      type: String,
      required: [true, 'Plan ID is required'],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Maintenance plan name is required'],
      trim: true,
      minlength: [3, 'Plan name must be at least 3 characters'],
      maxlength: [150, 'Plan name cannot exceed 150 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
      default: '',
    },
    assetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Asset',
      required: [true, 'Asset reference is required'],
      index: true,
    },
    hostelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hostel',
      required: [true, 'Hostel reference is required'],
      index: true,
    },
    assignedDepartmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: [true, 'Assigned department is required'],
      index: true,
    },
    preferredAssigneeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    maintenanceType: {
      type: String,
      required: true,
      enum: {
        values: MAINTENANCE_TYPE_VALUES,
        message: 'Invalid maintenance type',
      },
      default: MAINTENANCE_TYPES.PREVENTIVE,
      index: true,
    },
    frequency: {
      type: Number,
      required: [true, 'Frequency is required'],
      min: [1, 'Frequency must be at least 1'],
    },
    frequencyUnit: {
      type: String,
      required: true,
      enum: {
        values: FREQUENCY_UNIT_VALUES,
        message: 'Invalid frequency unit',
      },
      default: FREQUENCY_UNITS.MONTHS,
    },
    priority: {
      type: String,
      required: true,
      enum: {
        values: WORK_ORDER_PRIORITY_VALUES,
        message: 'Invalid priority',
      },
      default: WORK_ORDER_PRIORITIES.MEDIUM,
      index: true,
    },
    estimatedDuration: {
      type: Number,
      default: 2, // hours
      min: [0.5, 'Estimated duration must be at least 0.5 hours'],
    },
    status: {
      type: String,
      required: true,
      enum: {
        values: MAINTENANCE_PLAN_STATUS_VALUES,
        message: 'Invalid plan status',
      },
      default: MAINTENANCE_PLAN_STATUSES.ACTIVE,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    nextDueAt: {
      type: Date,
      required: [true, 'Next due date is required'],
      index: true,
    },
    lastCompletedAt: {
      type: Date,
      default: null,
    },
    lastWorkOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MaintenanceWorkOrder',
      default: null,
    },
    currentCycleNumber: {
      type: Number,
      default: 1,
    },
    upcomingReminderSentForCycle: {
      type: Number,
      default: 0,
    },
    overdueReminderSentForCycle: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Creator reference is required'],
      index: true,
    },
    auditLog: [planAuditSchema],
  },
  {
    timestamps: true,
  }
);

maintenancePlanSchema.index({ status: 1, nextDueAt: 1 });
maintenancePlanSchema.index({ assetId: 1, status: 1 });

const MaintenancePlan =
  mongoose.models.MaintenancePlan ||
  mongoose.model('MaintenancePlan', maintenancePlanSchema);

export default MaintenancePlan;
