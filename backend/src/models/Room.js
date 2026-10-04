import mongoose from 'mongoose';
import { ROOM_TYPE_VALUES } from '../constants/hostel.js';
import { buildSchemaOptions } from './schemaOptions.js';

const isInt = { validator: Number.isInteger, message: '{PATH} must be an integer' };

const OCCUPANCY_MSG = 'currentOccupancy cannot be greater than capacity';

const roomSchema = new mongoose.Schema(
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
      index: true,
    },
    floorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Floor',
      required: [true, 'floorId is required'],
    },
    roomNumber: {
      type: String,
      required: [true, 'roomNumber is required'],
      trim: true,
      uppercase: true,
      maxlength: 20,
    },
    roomType: {
      type: String,
      enum: { values: ROOM_TYPE_VALUES, message: '{VALUE} is not a valid room type' },
      required: [true, 'roomType is required'],
    },
    capacity: {
      type: Number,
      required: [true, 'capacity is required'],
      min: [1, 'capacity must be at least 1'],
      validate: [
        isInt,
        {
          // Lowering capacity below the current occupancy is not allowed either.
          validator(value) {
            const occ = this.currentOccupancy;
            return !Number.isFinite(occ) || occ <= value;
          },
          message: OCCUPANCY_MSG,
        },
      ],
    },
    currentOccupancy: {
      type: Number,
      default: 0,
      min: [0, 'currentOccupancy cannot be negative'],
      validate: [
        isInt,
        {
          validator(value) {
            const cap = this.capacity;
            return !Number.isFinite(cap) || value <= cap;
          },
          message: OCCUPANCY_MSG,
        },
      ],
    },
    isActive: { type: Boolean, default: true },
  },
  buildSchemaOptions()
);

// Room numbers are unique per floor; hostel+room lookups are common as well.
roomSchema.index({ floorId: 1, roomNumber: 1 }, { unique: true });
roomSchema.index({ hostelId: 1, blockId: 1, floorId: 1 });


// Referential integrity: block belongs to hostel, floor belongs to block.
roomSchema.pre('validate', async function checkHierarchy() {
  const relevant = ['hostelId', 'blockId', 'floorId'];
  if (!this.isNew && !relevant.some((p) => this.isModified(p))) return;
  if (!this.hostelId || !this.blockId || !this.floorId) return;

  const [block, floor] = await Promise.all([
    mongoose.model('Block').findById(this.blockId).select('hostelId').lean(),
    mongoose.model('Floor').findById(this.floorId).select('hostelId blockId').lean(),
  ]);

  if (!block) {
    this.invalidate('blockId', 'Referenced block does not exist');
  } else if (String(block.hostelId) !== String(this.hostelId)) {
    this.invalidate('blockId', 'Block does not belong to the given hostel');
  }

  if (!floor) {
    this.invalidate('floorId', 'Referenced floor does not exist');
  } else if (
    String(floor.blockId) !== String(this.blockId) ||
    String(floor.hostelId) !== String(this.hostelId)
  ) {
    this.invalidate('floorId', 'Floor does not belong to the given block/hostel');
  }
});

/**
 * Query-level rule: updateOne / findOneAndUpdate bypass document validation, so
 * enforce the occupancy rule there too for plain / $set updates of
 * capacity or currentOccupancy.
 *
 * NOTE: atomic `$inc` on these fields is NOT inspected here. Future allocation
 * code should use a conditional update instead, e.g.
 *   Room.updateOne({ _id, $expr: { $lt: ['$currentOccupancy', '$capacity'] } },
 *                  { $inc: { currentOccupancy: 1 } })
 */
async function checkOccupancyOnUpdate() {
  const update = this.getUpdate() || {};
  const set = { ...update, ...(update.$set || {}) };
  const hasCap = set.capacity !== undefined;
  const hasOcc = set.currentOccupancy !== undefined;
  if (!hasCap && !hasOcc) return;

  let capacity = hasCap ? Number(set.capacity) : undefined;
  let occupancy = hasOcc ? Number(set.currentOccupancy) : undefined;

  if (capacity === undefined || occupancy === undefined) {
    const existing = await this.model.findOne(this.getFilter()).select('capacity currentOccupancy').lean();
    if (!existing) return;
    capacity ??= existing.capacity;
    occupancy ??= existing.currentOccupancy;
  }

  if (occupancy > capacity) {
    const error = new mongoose.Error.ValidationError();
    error.addError(
      'currentOccupancy',
      new mongoose.Error.ValidatorError({
        message: OCCUPANCY_MSG,
        path: 'currentOccupancy',
        value: occupancy,
      })
    );
    throw error;
  }
}
roomSchema.pre('updateOne', checkOccupancyOnUpdate);
roomSchema.pre('findOneAndUpdate', checkOccupancyOnUpdate);

const Room = mongoose.models.Room || mongoose.model('Room', roomSchema);
export default Room;
