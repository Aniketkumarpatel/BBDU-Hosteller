import mongoose from 'mongoose';
import {
  ASSET_STATUS_VALUES,
  ASSET_STATUSES,
  ASSET_CONDITION_VALUES,
  ASSET_CONDITIONS,
  ASSET_TYPE_VALUES,
  ASSET_TYPES,
} from '../constants/workOrder.constants.js';
import { COMPLAINT_CATEGORY_VALUES } from '../constants/complaint.constants.js';
import {
  OPERATIONAL_FLAG_VALUES,
  OPERATIONAL_FLAGS,
} from '../constants/inventory.constants.js';

const movementHistorySchema = new mongoose.Schema(
  {
    previousLocation: {
      hostelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hostel', default: null },
      blockId: { type: mongoose.Schema.Types.ObjectId, ref: 'Block', default: null },
      floorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Floor', default: null },
      roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', default: null },
      commonArea: { type: String, default: null },
    },
    newLocation: {
      hostelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hostel', required: true },
      blockId: { type: mongoose.Schema.Types.ObjectId, ref: 'Block', default: null },
      floorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Floor', default: null },
      roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', default: null },
      commonArea: { type: String, default: null },
    },
    previousStatus: { type: String, default: null },
    newStatus: { type: String, default: null },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reason: { type: String, required: [true, 'Movement reason is required'], trim: true },
    changedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const conditionHistorySchema = new mongoose.Schema(
  {
    previousCondition: { type: String, default: null },
    newCondition: { type: String, required: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reason: { type: String, default: '', trim: true },
    changedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const lifecycleAuditSchema = new mongoose.Schema(
  {
    action: { type: String, required: true },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    previousStatus: { type: String, default: null },
    newStatus: { type: String, default: null },
    reason: { type: String, default: '' },
    remarks: { type: String, default: '' },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: true }
);

const assetSchema = new mongoose.Schema(
  {
    assetId: {
      type: String,
      required: [true, 'Asset ID is required'],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    assetCode: {
      type: String,
      trim: true,
      uppercase: true,
      index: true,
      default: '',
    },
    name: {
      type: String,
      required: [true, 'Asset name is required'],
      trim: true,
      minlength: [2, 'Asset name must be at least 2 characters'],
      maxlength: [120, 'Asset name cannot exceed 120 characters'],
    },
    assetType: {
      type: String,
      required: [true, 'Asset type is required'],
      enum: {
        values: ASSET_TYPE_VALUES,
        message: 'Invalid asset type',
      },
      default: ASSET_TYPES.OTHER,
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: {
        values: COMPLAINT_CATEGORY_VALUES,
        message: 'Invalid category',
      },
      index: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
      default: '',
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
    commonArea: {
      type: String,
      trim: true,
      default: null,
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: [true, 'Department reference is required'],
      index: true,
    },
    serialNumber: {
      type: String,
      trim: true,
      default: '',
    },
    modelNumber: {
      type: String,
      trim: true,
      default: '',
    },
    manufacturer: {
      type: String,
      trim: true,
      default: '',
    },
    vendor: {
      type: String,
      trim: true,
      default: '',
    },
    purchaseDate: {
      type: Date,
      default: null,
    },
    purchaseCost: {
      type: Number,
      min: [0, 'Purchase cost cannot be negative'],
      default: 0,
    },
    warrantyStartDate: {
      type: Date,
      default: null,
    },
    warrantyExpiryDate: {
      type: Date,
      default: null,
      index: true,
    },
    warrantyExpiry: {
      type: Date,
      default: null,
      index: true,
    },
    expectedLifeYears: {
      type: Number,
      min: [0, 'Expected life years cannot be negative'],
      default: 5,
    },
    status: {
      type: String,
      required: true,
      enum: {
        values: ASSET_STATUS_VALUES,
        message: 'Invalid asset status',
      },
      default: ASSET_STATUSES.ACTIVE,
      index: true,
    },
    condition: {
      type: String,
      required: true,
      enum: {
        values: ASSET_CONDITION_VALUES,
        message: 'Invalid asset condition',
      },
      default: ASSET_CONDITIONS.GOOD,
      index: true,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [1000, 'Notes cannot exceed 1000 characters'],
      default: '',
    },
    totalWorkOrders: {
      type: Number,
      min: 0,
      default: 0,
    },
    completedMaintenanceCount: {
      type: Number,
      min: 0,
      default: 0,
    },
    totalMaintenanceCost: {
      type: Number,
      min: [0, 'Total maintenance cost cannot be negative'],
      default: 0,
    },
    failureCount: {
      type: Number,
      min: 0,
      default: 0,
    },
    lastMaintenanceDate: {
      type: Date,
      default: null,
    },
    operationalFlag: {
      type: String,
      enum: {
        values: OPERATIONAL_FLAG_VALUES,
        message: 'Invalid operational flag',
      },
      default: OPERATIONAL_FLAGS.NORMAL,
      index: true,
    },
    replacementRecommended: {
      type: Boolean,
      default: false,
      index: true,
    },
    replacementRecommendationReason: {
      type: String,
      default: '',
      trim: true,
    },
    qrCodeData: {
      type: String,
      default: '',
      trim: true,
    },
    movementHistory: [movementHistorySchema],
    conditionHistory: [conditionHistorySchema],
    lifecycleAuditLog: [lifecycleAuditSchema],
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
    lastWarrantyNotificationAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Synchronization and default values pre-save hook
assetSchema.pre('save', function () {
  if (!this.assetCode && this.assetId) {
    this.assetCode = this.assetId;
  }
  if (this.warrantyExpiryDate && !this.warrantyExpiry) {
    this.warrantyExpiry = this.warrantyExpiryDate;
  } else if (this.warrantyExpiry && !this.warrantyExpiryDate) {
    this.warrantyExpiryDate = this.warrantyExpiry;
  }
});

assetSchema.index({ hostelId: 1, roomId: 1 });
assetSchema.index({ departmentId: 1, status: 1 });
assetSchema.index({ hostelId: 1, operationalFlag: 1 });
assetSchema.index({ hostelId: 1, replacementRecommended: 1 });

const Asset = mongoose.models.Asset || mongoose.model('Asset', assetSchema);

export default Asset;
