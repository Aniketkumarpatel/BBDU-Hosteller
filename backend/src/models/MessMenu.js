import mongoose from 'mongoose';
import { DAYS_OF_WEEK, MEAL_TYPE_VALUES } from '../constants/mess.constants.js';
import { buildSchemaOptions } from './schemaOptions.js';

const menuItemSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Item name is required'],
      trim: true,
      maxlength: [100, 'Item name cannot exceed 100 characters'],
    },
    category: {
      type: String,
      trim: true,
      default: 'Main Course',
      maxlength: [50, 'Category cannot exceed 50 characters'],
    },
    isSpecial: {
      type: Boolean,
      default: false,
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: [200, 'Description cannot exceed 200 characters'],
    },
  },
  { _id: true }
);

const messMenuSchema = new mongoose.Schema(
  {
    menuId: {
      type: String,
      required: [true, 'Menu ID is required'],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    messId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Mess',
      required: [true, 'Mess reference is required'],
      index: true,
    },
    date: {
      type: String, // 'YYYY-MM-DD' calendar date, null for recurring weekly templates
      trim: true,
      default: null,
      index: true,
    },
    dayOfWeek: {
      type: String,
      required: [true, 'Day of week is required'],
      enum: {
        values: DAYS_OF_WEEK,
        message: '{VALUE} is not a valid day of the week',
      },
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
    menuItems: {
      type: [menuItemSchema],
      default: [],
    },
    notes: {
      type: String,
      trim: true,
      default: '',
      maxlength: [500, 'Notes cannot exceed 500 characters'],
    },
    effectiveDate: {
      type: Date,
      default: null,
    },
    isPublished: {
      type: Boolean,
      default: false,
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
  buildSchemaOptions()
);

messMenuSchema.index({ messId: 1, date: 1, dayOfWeek: 1, mealType: 1 }, { unique: true });

const MessMenu = mongoose.models.MessMenu || mongoose.model('MessMenu', messMenuSchema);
export default MessMenu;
