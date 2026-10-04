import mongoose from 'mongoose';
import {
  CYCLE_STATUSES,
  CYCLE_STATUS_VALUES,
} from '../constants/preventiveMaintenance.constants.js';

const maintenanceCycleSchema = new mongoose.Schema(
  {
    cycleId: {
      type: String,
      required: [true, 'Cycle ID is required'],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MaintenancePlan',
      required: [true, 'Maintenance plan reference is required'],
      index: true,
    },
    assetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Asset',
      required: [true, 'Asset reference is required'],
      index: true,
    },
    cycleNumber: {
      type: Number,
      required: true,
    },
    scheduledDate: {
      type: Date,
      required: true,
    },
    dueDate: {
      type: Date,
      required: true,
      index: true,
    },
    workOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MaintenanceWorkOrder',
      default: null,
      index: true,
    },
    assignedStaffId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    status: {
      type: String,
      required: true,
      enum: {
        values: CYCLE_STATUS_VALUES,
        message: 'Invalid cycle status',
      },
      default: CYCLE_STATUSES.SCHEDULED,
      index: true,
    },
    isOverdue: {
      type: Boolean,
      default: false,
      index: true,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    completionNotes: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

maintenanceCycleSchema.index({ planId: 1, cycleNumber: 1 }, { unique: true });
maintenanceCycleSchema.index({ assetId: 1, dueDate: -1 });

const MaintenanceCycle =
  mongoose.models.MaintenanceCycle ||
  mongoose.model('MaintenanceCycle', maintenanceCycleSchema);

export default MaintenanceCycle;
