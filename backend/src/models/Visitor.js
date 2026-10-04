import mongoose from 'mongoose';
import {
  VISITOR_STATUSES,
  VISITOR_STATUS_VALUES,
  GOVERNMENT_ID_TYPE_VALUES,
} from '../constants/outpass.constants.js';

const visitorAuditLogSchema = new mongoose.Schema(
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

const visitorSchema = new mongoose.Schema(
  {
    visitorId: {
      type: String,
      required: [true, 'Visitor ID is required'],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    visitorName: {
      type: String,
      required: [true, 'Visitor name is required'],
      trim: true,
      maxlength: [100, 'Visitor name cannot exceed 100 characters'],
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
    },
    governmentIdType: {
      type: String,
      enum: {
        values: GOVERNMENT_ID_TYPE_VALUES,
        message: 'Invalid government ID type',
      },
      default: 'OTHER',
    },
    governmentIdLast4: {
      type: String,
      trim: true,
      maxlength: [4, 'Only store the last 4 digits of government ID for privacy compliance'],
      default: '',
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Host student reference is required'],
      index: true,
    },
    hostelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hostel',
      required: [true, 'Hostel reference is required'],
      index: true,
    },
    relationship: {
      type: String,
      required: [true, 'Relationship with student is required'],
      trim: true,
      maxlength: [50, 'Relationship cannot exceed 50 characters'],
    },
    purpose: {
      type: String,
      required: [true, 'Visit purpose is required'],
      trim: true,
      maxlength: [200, 'Purpose cannot exceed 200 characters'],
    },
    visitDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    expectedCheckIn: {
      type: Date,
      default: null,
    },
    expectedCheckOut: {
      type: Date,
      default: null,
    },
    actualCheckIn: {
      type: Date,
      default: null,
    },
    actualCheckOut: {
      type: Date,
      default: null,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    checkedOutBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    status: {
      type: String,
      required: [true, 'Status is required'],
      enum: {
        values: VISITOR_STATUS_VALUES,
        message: 'Invalid visitor status',
      },
      default: VISITOR_STATUSES.REQUESTED,
      index: true,
    },
    remarks: {
      type: String,
      trim: true,
      maxlength: [500, 'Remarks cannot exceed 500 characters'],
      default: '',
    },
    auditLog: [visitorAuditLogSchema],
  },
  {
    timestamps: true,
  }
);

visitorSchema.index({ hostelId: 1, status: 1, visitDate: 1 });
visitorSchema.index({ studentId: 1, status: 1 });

const Visitor = mongoose.models.Visitor || mongoose.model('Visitor', visitorSchema);

export default Visitor;
