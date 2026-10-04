import mongoose from 'mongoose';
import { COMPLAINT_CATEGORY_VALUES, COMPLAINT_PRIORITY_VALUES } from '../constants/complaint.constants.js';

const slaRuleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'SLA rule name is required'],
      trim: true,
      minlength: [3, 'Name must be at least 3 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    code: {
      type: String,
      required: [true, 'SLA rule code is required'],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
      default: '',
    },
    category: {
      type: String,
      enum: {
        values: [...COMPLAINT_CATEGORY_VALUES, null],
        message: 'Invalid category for SLA rule',
      },
      default: null,
      index: true,
    },
    priority: {
      type: String,
      required: [true, 'Priority is required'],
      enum: {
        values: COMPLAINT_PRIORITY_VALUES,
        message: 'Invalid priority for SLA rule',
      },
      index: true,
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
      index: true,
    },
    initialResponseHours: {
      type: Number,
      default: 2,
      min: [0, 'Initial response hours cannot be negative'],
    },
    resolutionHours: {
      type: Number,
      required: [true, 'Resolution duration (hours) is required'],
      min: [0.1, 'Resolution hours must be greater than 0'],
    },
    reminderThresholdPercent: {
      type: Number,
      default: 75,
      min: [1, 'Reminder threshold percent must be at least 1%'],
      max: [99, 'Reminder threshold percent cannot exceed 99%'],
    },
    reminderThresholdHours: {
      type: Number,
      default: null,
    },
    escalationEnabled: {
      type: Boolean,
      default: true,
    },
    escalationAfterHours: {
      type: Number,
      default: 0,
      min: [0, 'Escalation after hours cannot be negative'],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Auto-compute reminderThresholdHours before saving if not explicitly set
slaRuleSchema.pre('save', function () {
  if (this.resolutionHours && this.reminderThresholdPercent) {
    this.reminderThresholdHours = +(
      this.resolutionHours *
      (this.reminderThresholdPercent / 100)
    ).toFixed(2);
  }
});

slaRuleSchema.index({ priority: 1, category: 1, departmentId: 1, isActive: 1 });

const SlaRule = mongoose.models.SlaRule || mongoose.model('SlaRule', slaRuleSchema);
export default SlaRule;
