import mongoose from 'mongoose';
import { VERIFICATION_DECISION_VALUES } from '../constants/complaint.constants.js';

const complaintResolutionSchema = new mongoose.Schema(
  {
    complaintId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Complaint',
      required: true,
      index: true,
    },
    attemptNumber: {
      type: Number,
      default: 1,
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    resolutionNote: {
      type: String,
      required: [true, 'Resolution note is required'],
      trim: true,
      maxlength: [2000, 'Resolution note cannot exceed 2000 characters'],
    },
    resolvedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    verificationDecision: {
      type: String,
      enum: [...VERIFICATION_DECISION_VALUES, null],
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
    reopened: {
      type: Boolean,
      default: false,
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
  },
  { timestamps: true }
);

const ComplaintResolution = mongoose.model('ComplaintResolution', complaintResolutionSchema);

export default ComplaintResolution;
