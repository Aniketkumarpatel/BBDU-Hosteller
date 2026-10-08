import mongoose from 'mongoose';
import { ROLES, ROLE_VALUES } from '../constants/roles.js';
import { buildSchemaOptions } from './schemaOptions.js';

const objectId = (ref) => ({ type: mongoose.Schema.Types.ObjectId, ref });

// Never leak the password hash, regardless of how the document is serialised.
const hidePasswordHash = (_doc, ret) => {
  delete ret.passwordHash;
  return ret;
};

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Name is required'], trim: true, maxlength: 120 },
    email: {
      type: String,
      required: [true, 'Email is required'],
      trim: true,
      lowercase: true,
      unique: true,
      maxlength: 254,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email address'],
    },
    phone: {
      type: String,
      trim: true,
      match: [/^\+?[0-9]{7,15}$/, 'Please provide a valid phone number (7-15 digits)'],
    },
    // Stores a bcrypt/argon hash only (hashing is added with authentication).
    // `select: false` keeps it out of queries unless explicitly requested.
    passwordHash: { type: String, required: [true, 'passwordHash is required'], select: false },
    role: {
      type: String,
      enum: { values: ROLE_VALUES, message: '{VALUE} is not a valid role' },
      default: ROLES.STUDENT,
      required: true,
    },
    studentId: { type: String, trim: true, uppercase: true, maxlength: 50 },
    employeeId: { type: String, trim: true, uppercase: true, maxlength: 50 },
    hostelId: objectId('Hostel'),
    blockId: objectId('Block'),
    floorId: objectId('Floor'),
    roomId: objectId('Room'),
    roomNumber: { type: String, trim: true },
    departmentId: objectId('Department'),
    isActive: { type: Boolean, default: true },
  },
  buildSchemaOptions(hidePasswordHash)
);

// studentId / employeeId are optional but unique when present.
// (partial index so many users without the field don't collide on null)
userSchema.index(
  { studentId: 1 },
  { unique: true, partialFilterExpression: { studentId: { $type: 'string' } } }
);
userSchema.index(
  { employeeId: 1 },
  { unique: true, partialFilterExpression: { employeeId: { $type: 'string' } } }
);

// Common query patterns.
userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ hostelId: 1, role: 1 });
userSchema.index({ departmentId: 1 });
userSchema.index({ roomId: 1 });

const User = mongoose.models.User || mongoose.model('User', userSchema);
export default User;
