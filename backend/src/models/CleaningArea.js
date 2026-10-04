import mongoose from 'mongoose';
import {
  AREA_TYPE_VALUES,
  CLEANING_PRIORITY_VALUES,
} from '../constants/cleaning.constants.js';

const cleaningAreaSchema = new mongoose.Schema(
  {
    areaId: {
      type: String,
      required: [true, 'Area ID is required'],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Area name is required'],
      trim: true,
      maxlength: [100, 'Area name cannot exceed 100 characters'],
    },
    areaType: {
      type: String,
      required: [true, 'Area type is required'],
      enum: {
        values: AREA_TYPE_VALUES,
        message: 'Invalid area type',
      },
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
      index: true,
    },
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      default: null,
      index: true,
    },
    locationDescription: {
      type: String,
      trim: true,
      maxlength: [200, 'Location description cannot exceed 200 characters'],
      default: '',
    },
    priority: {
      type: String,
      enum: {
        values: CLEANING_PRIORITY_VALUES,
        message: 'Invalid priority level',
      },
      default: 'MEDIUM',
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    customChecklist: [
      {
        type: String,
        trim: true,
      },
    ],
    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'Notes cannot exceed 500 characters'],
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

cleaningAreaSchema.index({ hostelId: 1, areaType: 1, isActive: 1 });

const CleaningArea =
  mongoose.models.CleaningArea || mongoose.model('CleaningArea', cleaningAreaSchema);

export default CleaningArea;
