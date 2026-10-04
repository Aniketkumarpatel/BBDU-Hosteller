import mongoose from 'mongoose';
import {
  NOTICE_CATEGORIES,
  NOTICE_CATEGORY_VALUES,
  NOTICE_PRIORITIES,
  NOTICE_PRIORITY_VALUES,
  NOTICE_STATUSES,
  NOTICE_STATUS_VALUES,
  NOTICE_TARGET_AUDIENCES,
  NOTICE_TARGET_AUDIENCE_VALUES,
} from '../constants/studentServices.constants.js';

const noticeAcknowledgementSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    acknowledgedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const noticeViewSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    viewedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const noticeSchema = new mongoose.Schema(
  {
    noticeId: {
      type: String,
      required: [true, 'Notice ID is required'],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Notice title is required'],
      trim: true,
      minlength: [3, 'Title must be at least 3 characters'],
      maxlength: [180, 'Notice title cannot exceed 180 characters'],
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    // Backward-compatible alias with MessNotice.message
    message: {
      type: String,
      trim: true,
      default: function () {
        return this.description || '';
      },
    },
    category: {
      type: String,
      enum: NOTICE_CATEGORY_VALUES,
      default: NOTICE_CATEGORIES.GENERAL,
      index: true,
    },
    priority: {
      type: String,
      enum: NOTICE_PRIORITY_VALUES,
      default: NOTICE_PRIORITIES.NORMAL,
      index: true,
    },
    status: {
      type: String,
      enum: NOTICE_STATUS_VALUES,
      default: NOTICE_STATUSES.PUBLISHED,
      index: true,
    },
    // Target audience scope
    targetAudience: {
      type: String,
      enum: NOTICE_TARGET_AUDIENCE_VALUES,
      default: NOTICE_TARGET_AUDIENCES.ALL,
      index: true,
    },
    targetRole: {
      type: String,
      default: null,
    },
    // Geographic targeting
    hostelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hostel',
      default: null,
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
    },
    // Step 10 backward compatibility: optional messId
    messId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Mess',
      default: null,
      index: true,
    },
    publishAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    expiresAt: {
      type: Date,
      default: null,
      index: true,
    },
    // Step 10 aliases
    effectiveFrom: {
      type: Date,
      default: Date.now,
    },
    effectiveUntil: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    requiresAcknowledgement: {
      type: Boolean,
      default: false,
      index: true,
    },
    acknowledgements: [noticeAcknowledgementSchema],
    views: [noticeViewSchema],
    viewCount: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Creator reference is required'],
    },
    publishedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Synchronous pre-save hook to keep backward-compatible fields in sync
noticeSchema.pre('save', function () {
  if (this.description && !this.message) {
    this.message = this.description;
  } else if (this.message && !this.description) {
    this.description = this.message;
  }

  if (this.publishAt && !this.effectiveFrom) {
    this.effectiveFrom = this.publishAt;
  }
  if (this.expiresAt && !this.effectiveUntil) {
    this.effectiveUntil = this.expiresAt;
  }
});

const Notice =
  mongoose.models.Notice || mongoose.model('Notice', noticeSchema, 'notices');

export default Notice;
