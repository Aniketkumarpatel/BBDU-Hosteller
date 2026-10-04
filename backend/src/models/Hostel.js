import mongoose from 'mongoose';
import { HOSTEL_TYPE_VALUES, HOSTEL_TYPES } from '../constants/hostel.js';
import { buildSchemaOptions } from './schemaOptions.js';

const hostelSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Hostel name is required'], trim: true, maxlength: 120 },
    code: {
      type: String,
      required: [true, 'Hostel code is required'],
      trim: true,
      uppercase: true,
      maxlength: 20,
      unique: true,
    },
    type: {
      type: String,
      enum: { values: HOSTEL_TYPE_VALUES, message: '{VALUE} is not a valid hostel type' },
      default: HOSTEL_TYPES.MIXED,
    },
    address: { type: String, trim: true, maxlength: 300 },
    description: { type: String, trim: true, maxlength: 1000 },
    isActive: { type: Boolean, default: true },
  },
  buildSchemaOptions()
);

hostelSchema.index({ isActive: 1 });

const Hostel = mongoose.models.Hostel || mongoose.model('Hostel', hostelSchema);
export default Hostel;
