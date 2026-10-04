import mongoose from 'mongoose';
import { MEAL_TYPE_VALUES, FOOD_QUALITY_VALUES } from '../constants/mess.constants.js';
import { buildSchemaOptions } from './schemaOptions.js';

const messFeedbackSchema = new mongoose.Schema(
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
    messId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Mess',
      required: [true, 'Mess reference is required'],
      index: true,
    },
    mealType: {
      type: String,
      required: [true, 'Meal type is required'],
      enum: {
        values: MEAL_TYPE_VALUES,
        message: '{VALUE} is not a valid meal type',
      },
      index: true,
    },
    mealDate: {
      type: Date,
      required: [true, 'Meal date is required'],
      index: true,
    },
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot exceed 5'],
      index: true,
    },
    foodQuality: {
      type: String,
      required: [true, 'Food quality category is required'],
      enum: {
        values: FOOD_QUALITY_VALUES,
        message: '{VALUE} is not a valid food quality value',
      },
      index: true,
    },
    taste: {
      type: Number,
      min: [1, 'Taste score must be at least 1'],
      max: [5, 'Taste score cannot exceed 5'],
      default: 3,
    },
    hygiene: {
      type: Number,
      min: [1, 'Hygiene score must be at least 1'],
      max: [5, 'Hygiene score cannot exceed 5'],
      default: 3,
      index: true,
    },
    quantity: {
      type: Number,
      min: [1, 'Quantity score must be at least 1'],
      max: [5, 'Quantity score cannot exceed 5'],
      default: 3,
    },
    comments: {
      type: String,
      trim: true,
      default: '',
      maxlength: [500, 'Comments cannot exceed 500 characters'],
    },
  },
  buildSchemaOptions()
);

// Enforce one feedback per student per mess per meal per day
messFeedbackSchema.index(
  { studentId: 1, messId: 1, mealDate: 1, mealType: 1 },
  { unique: true }
);

const MessFeedback =
  mongoose.models.MessFeedback || mongoose.model('MessFeedback', messFeedbackSchema);
export default MessFeedback;
