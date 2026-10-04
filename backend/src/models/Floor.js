import mongoose from 'mongoose';
import { buildSchemaOptions } from './schemaOptions.js';

const floorSchema = new mongoose.Schema(
  {
    hostelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hostel',
      required: [true, 'hostelId is required'],
      index: true,
    },
    blockId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Block',
      required: [true, 'blockId is required'],
    },
    floorNumber: {
      type: Number,
      required: [true, 'floorNumber is required'],
      min: [0, 'floorNumber cannot be negative'],
      validate: { validator: Number.isInteger, message: 'floorNumber must be an integer' },
    },
    name: { type: String, trim: true, maxlength: 120 },
    isActive: { type: Boolean, default: true },
  },
  buildSchemaOptions()
);

// One floor number per block.
floorSchema.index({ blockId: 1, floorNumber: 1 }, { unique: true });

// Default display name, e.g. "Floor 2" (0 => "Ground Floor").
floorSchema.pre('validate', function setDefaultName() {
  if (!this.name && Number.isInteger(this.floorNumber)) {
    this.name = this.floorNumber === 0 ? 'Ground Floor' : `Floor ${this.floorNumber}`;
  }
});

// Referential integrity: the block must exist and belong to the given hostel.
floorSchema.pre('validate', async function checkHierarchy() {
  if (!this.isNew && !this.isModified('hostelId') && !this.isModified('blockId')) return;
  if (!this.hostelId || !this.blockId) return;

  const block = await mongoose.model('Block').findById(this.blockId).select('hostelId').lean();
  if (!block) {
    this.invalidate('blockId', 'Referenced block does not exist');
  } else if (String(block.hostelId) !== String(this.hostelId)) {
    this.invalidate('blockId', 'Block does not belong to the given hostel');
  }
});

const Floor = mongoose.models.Floor || mongoose.model('Floor', floorSchema);
export default Floor;
