import mongoose from 'mongoose';
import {
  STUDENT_FEEDBACK_CATEGORIES,
  STUDENT_FEEDBACK_CATEGORY_VALUES,
  STUDENT_FEEDBACK_STATUSES,
  STUDENT_FEEDBACK_STATUS_VALUES,
} from '../constants/studentServices.constants.js';

const studentFeedbackSchema = new mongoose.Schema(
  {
    feedbackId: {
      type: String,
      required: [true, 'Feedback ID is required'],
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
    category: {
      type: String,
      required: [true, 'Feedback category is required'],
      enum: STUDENT_FEEDBACK_CATEGORY_VALUES,
      default: STUDENT_FEEDBACK_CATEGORIES.GENERAL || STUDENT_FEEDBACK_CATEGORIES.HOSTEL,
      index: true,
    },
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: [1, 'Minimum rating is 1'],
      max: [5, 'Maximum rating is 5'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      minlength: [3, 'Title must be at least 3 characters'],
      maxlength: [180, 'Title cannot exceed 180 characters'],
    },
    comment: {
      type: String,
      required: [true, 'Feedback comment is required'],
      trim: true,
      minlength: [5, 'Comment must be at least 5 characters'],
      maxlength: [2000, 'Comment cannot exceed 2000 characters'],
    },
    serviceRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ServiceRequest',
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: STUDENT_FEEDBACK_STATUS_VALUES,
      default: STUDENT_FEEDBACK_STATUSES.SUBMITTED,
      index: true,
    },
    responseNote: {
      type: String,
      trim: true,
      default: '',
    },
    respondedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    respondedAt: {
      type: Date,
      default: null,
    },
    isAnonymous: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

studentFeedbackSchema.index({ hostelId: 1, status: 1, category: 1 });
studentFeedbackSchema.index({ studentId: 1, createdAt: -1 });

const StudentFeedback =
  mongoose.models.StudentFeedback ||
  mongoose.model('StudentFeedback', studentFeedbackSchema);

export default StudentFeedback;
