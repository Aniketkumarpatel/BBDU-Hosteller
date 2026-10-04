import mongoose from 'mongoose';
import {
  SERVICE_REQUEST_CATEGORIES,
  SERVICE_REQUEST_CATEGORY_VALUES,
  SERVICE_REQUEST_STATUSES,
  SERVICE_REQUEST_STATUS_VALUES,
  SERVICE_REQUEST_PRIORITIES,
  SERVICE_REQUEST_PRIORITY_VALUES,
} from '../constants/studentServices.constants.js';

const serviceRequestTimelineSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      trim: true,
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    previousStatus: {
      type: String,
      default: null,
    },
    newStatus: {
      type: String,
      default: null,
    },
    notes: {
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

const serviceRequestSchema = new mongoose.Schema(
  {
    requestId: {
      type: String,
      required: [true, 'Request ID is required'],
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
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
    },
    category: {
      type: String,
      required: [true, 'Service request category is required'],
      enum: SERVICE_REQUEST_CATEGORY_VALUES,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      minlength: [3, 'Title must be at least 3 characters'],
      maxlength: [180, 'Title cannot exceed 180 characters'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      minlength: [5, 'Description must be at least 5 characters'],
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    priority: {
      type: String,
      enum: SERVICE_REQUEST_PRIORITY_VALUES,
      default: SERVICE_REQUEST_PRIORITIES.NORMAL,
      index: true,
    },
    status: {
      type: String,
      enum: SERVICE_REQUEST_STATUS_VALUES,
      default: SERVICE_REQUEST_STATUSES.SUBMITTED,
      index: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    submittedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    closedAt: {
      type: Date,
      default: null,
    },
    resolutionNote: {
      type: String,
      trim: true,
      default: '',
    },
    rejectionReason: {
      type: String,
      trim: true,
      default: '',
    },
    actionRequiredNote: {
      type: String,
      trim: true,
      default: '',
    },
    studentVerification: {
      isSatisfied: { type: Boolean, default: null },
      feedback: { type: String, trim: true, default: '' },
      verifiedAt: { type: Date, default: null },
    },
    timeline: [serviceRequestTimelineSchema],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
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

serviceRequestSchema.index({ hostelId: 1, status: 1, category: 1 });
serviceRequestSchema.index({ studentId: 1, status: 1 });

const ServiceRequest =
  mongoose.models.ServiceRequest ||
  mongoose.model('ServiceRequest', serviceRequestSchema);

export default ServiceRequest;
