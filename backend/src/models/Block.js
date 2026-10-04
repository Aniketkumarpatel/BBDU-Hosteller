import mongoose from 'mongoose';
import { buildSchemaOptions } from './schemaOptions.js';

const blockSchema = new mongoose.Schema(
  {
    hostelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hostel',
      required: [true, 'hostelId is required'],
      index: true,
    },
    name: { type: String, required: [true, 'Block name is required'], trim: true, maxlength: 120 },
    code: {
      type: String,
      required: [true, 'Block code is required'],
      trim: true,
      uppercase: true,
      maxlength: 20,
    },
    description: { type: String, trim: true, maxlength: 1000 },
    isActive: { type: Boolean, default: true },
  },
  buildSchemaOptions()
);

// A block code / name must be unique within its hostel (not globally).
blockSchema.index({ hostelId: 1, code: 1 }, { unique: true });
blockSchema.index({ hostelId: 1, name: 1 }, { unique: true });

const Block = mongoose.models.Block || mongoose.model('Block', blockSchema);
export default Block;
