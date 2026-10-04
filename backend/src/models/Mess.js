import mongoose from 'mongoose';
import { buildSchemaOptions } from './schemaOptions.js';

const messSchema = new mongoose.Schema(
  {
    messId: {
      type: String,
      required: [true, 'Mess ID is required'],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Mess name is required'],
      trim: true,
      maxlength: [120, 'Mess name cannot exceed 120 characters'],
    },
    code: {
      type: String,
      required: [true, 'Mess code is required'],
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: [30, 'Mess code cannot exceed 30 characters'],
      index: true,
    },
    hostelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hostel',
      required: [true, 'Hostel reference is required'],
      index: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    capacity: {
      type: Number,
      default: 250,
      min: [1, 'Capacity must be at least 1'],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  buildSchemaOptions()
);

const Mess = mongoose.models.Mess || mongoose.model('Mess', messSchema);
export default Mess;
