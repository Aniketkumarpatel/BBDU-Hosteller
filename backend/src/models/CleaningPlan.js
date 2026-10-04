import mongoose from 'mongoose';
import {
  CLEANING_TYPE_VALUES,
  CLEANING_FREQUENCY_VALUES,
  CLEANING_PRIORITY_VALUES,
} from '../constants/cleaning.constants.js';

const cleaningPlanSchema = new mongoose.Schema(
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
      required: [true, 'Plan name is required'],
      trim: true,
      maxlength: [100, 'Plan name cannot exceed 100 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
      default: '',
    },
    cleaningAreaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CleaningArea',
      required: [true, 'Cleaning Area is required'],
      index: true,
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
    frequency: {
      type: String,
      required: [true, 'Frequency is required'],
      enum: {
        values: CLEANING_FREQUENCY_VALUES,
        message: 'Invalid cleaning frequency',
      },
      default: 'DAILY',
    },
    frequencyInterval: {
      type: Number,
      default: 1,
      min: [1, 'Frequency interval must be at least 1'],
    },
    frequencyUnit: {
      type: String,
      enum: ['DAYS', 'WEEKS', 'MONTHS'],
      default: 'DAYS',
    },
    preferredAssigneeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
    },
    checklist: [
      {
        item: {
          type: String,
          required: true,
          trim: true,
        },
        isMandatory: {
          type: Boolean,
          default: true,
        },
      },
    ],
    estimatedDurationMinutes: {
      type: Number,
      default: 30,
      min: [5, 'Estimated duration must be at least 5 minutes'],
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    nextDueAt: {
      type: Date,
      required: true,
      index: true,
    },
    lastGeneratedAt: {
      type: Date,
      default: null,
    },
    lastCompletedAt: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

cleaningPlanSchema.index({ isActive: 1, nextDueAt: 1 });

const CleaningPlan =
  mongoose.models.CleaningPlan || mongoose.model('CleaningPlan', cleaningPlanSchema);

export default CleaningPlan;
