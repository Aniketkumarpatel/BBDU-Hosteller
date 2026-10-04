import mongoose from 'mongoose';
import { VENDOR_SERVICE_CATEGORY_VALUES } from '../constants/finance.constants.js';

const vendorSchema = new mongoose.Schema(
  {
    vendorId: {
      type: String,
      required: [true, 'Vendor ID is required'],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    vendorCode: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      uppercase: true,
    },
    name: {
      type: String,
      required: [true, 'Vendor name is required'],
      trim: true,
      minlength: [2, 'Vendor name must be at least 2 characters'],
      maxlength: [150, 'Vendor name cannot exceed 150 characters'],
      index: true,
    },
    serviceCategory: {
      type: String,
      required: [true, 'Service category is required'],
      enum: VENDOR_SERVICE_CATEGORY_VALUES,
      index: true,
    },
    contactName: {
      type: String,
      trim: true,
      default: '',
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
    },
    address: {
      type: String,
      trim: true,
      default: '',
    },
    hostelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hostel',
      default: null, // null represents campus-wide vendor
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

const Vendor =
  mongoose.models.Vendor || mongoose.model('Vendor', vendorSchema);

export default Vendor;
