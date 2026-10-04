import mongoose from 'mongoose';
import { ROLE_VALUES } from '../constants/roles.js';
import { COMPLAINT_PRIORITY_VALUES } from '../constants/complaint.constants.js';

const escalationRuleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Escalation rule name is required'],
      trim: true,
      minlength: [3, 'Name must be at least 3 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    code: {
      type: String,
      required: [true, 'Escalation rule code is required'],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    escalationLevel: {
      type: Number,
      required: [true, 'Escalation level is required'],
      min: [1, 'Escalation level must be at least 1'],
      index: true,
    },
    fromRole: {
      type: String,
      required: [true, 'Source role (fromRole) is required'],
      enum: {
        values: ROLE_VALUES,
        message: 'Invalid fromRole',
      },
      index: true,
    },
    toRole: {
      type: String,
      required: [true, 'Target role (toRole) is required'],
      enum: {
        values: ROLE_VALUES,
        message: 'Invalid toRole',
      },
      index: true,
    },
    fromDepartmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
    },
    toDepartmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
    },
    hostelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hostel',
      default: null,
      index: true,
    },
    priority: {
      type: String,
      enum: {
        values: [...COMPLAINT_PRIORITY_VALUES, null],
        message: 'Invalid priority',
      },
      default: null,
    },
    nextAuthorityRole: {
      type: String,
      required: [true, 'nextAuthorityRole is required'],
      enum: {
        values: ROLE_VALUES,
        message: 'Invalid nextAuthorityRole',
      },
    },
    nextAuthorityUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    escalationAfterHours: {
      type: Number,
      default: 0,
      min: [0, 'Escalation after hours cannot be negative'],
    },
    resolutionHours: {
      type: Number,
      default: 24,
      min: [0.1, 'Resolution hours for new cycle must be positive'],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

escalationRuleSchema.index({ escalationLevel: 1, fromRole: 1, toRole: 1, isActive: 1 });

const EscalationRule =
  mongoose.models.EscalationRule || mongoose.model('EscalationRule', escalationRuleSchema);
export default EscalationRule;
