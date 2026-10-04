import mongoose from 'mongoose';
import {
  OUTPASS_STATUSES,
  OUTPASS_STATUS_VALUES,
  OUTPASS_PURPOSE_VALUES,
} from '../constants/outpass.constants.js';

const outpassAuditLogSchema = new mongoose.Schema(
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

const outpassSchema = new mongoose.Schema(
  {
    outpassId: {
      type: String,
      required: [true, 'Outpass ID is required'],
      unique: true,
      trim: true,
      uppercase: true,
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
      default: null,
      index: true,
    },
    floorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Floor',
      default: null,
    },
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      default: null,
      index: true,
    },
    purpose: {
      type: String,
      required: [true, 'Outpass purpose is required'],
      enum: {
        values: OUTPASS_PURPOSE_VALUES,
        message: 'Invalid outpass purpose',
      },
    },
    destination: {
      type: String,
      required: [true, 'Destination is required'],
      trim: true,
      maxlength: [200, 'Destination cannot exceed 200 characters'],
    },
    departureAt: {
      type: Date,
      required: [true, 'Departure time is required'],
      index: true,
    },
    expectedReturnAt: {
      type: Date,
      required: [true, 'Expected return time is required'],
      index: true,
    },
    actualExitAt: {
      type: Date,
      default: null,
    },
    actualReturnAt: {
      type: Date,
      default: null,
    },
    emergencyContact: {
      name: { type: String, trim: true, default: '' },
      phone: { type: String, trim: true, default: '' },
      relation: { type: String, trim: true, default: '' },
    },
    remarks: {
      type: String,
      trim: true,
      maxlength: [500, 'Remarks cannot exceed 500 characters'],
      default: '',
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
    approvalRemarks: {
      type: String,
      trim: true,
      default: '',
    },
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    rejectedAt: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      trim: true,
      default: '',
    },
    verifiedExitBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    verifiedReturnBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    exitRemarks: {
      type: String,
      trim: true,
      default: '',
    },
    returnRemarks: {
      type: String,
      trim: true,
      default: '',
    },
    digitalPassToken: {
      type: String,
      default: null,
      index: true,
    },
    status: {
      type: String,
      required: [true, 'Status is required'],
      enum: {
        values: OUTPASS_STATUS_VALUES,
        message: 'Invalid outpass status',
      },
      default: OUTPASS_STATUSES.PENDING,
      index: true,
    },
    isEmergency: {
      type: Boolean,
      default: false,
      index: true,
    },
    overdueNotifiedAt: {
      type: Date,
      default: null,
    },
    auditLog: [outpassAuditLogSchema],
  },
  {
    timestamps: true,
  }
);

outpassSchema.index({ hostelId: 1, status: 1, expectedReturnAt: 1 });
outpassSchema.index({ studentId: 1, status: 1 });

const Outpass = mongoose.models.Outpass || mongoose.model('Outpass', outpassSchema);

export default Outpass;
