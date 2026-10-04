import mongoose from 'mongoose';
import { buildSchemaOptions } from './schemaOptions.js';

const departmentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Department name is required'],
      trim: true,
      maxlength: 120,
      unique: true,
    },
    code: {
      type: String,
      required: [true, 'Department code is required'],
      trim: true,
      uppercase: true,
      maxlength: 20,
      unique: true,
    },
    description: { type: String, trim: true, maxlength: 1000 },
    isActive: { type: Boolean, default: true },
  },
  buildSchemaOptions()
);

const Department = mongoose.models.Department || mongoose.model('Department', departmentSchema);
export default Department;
