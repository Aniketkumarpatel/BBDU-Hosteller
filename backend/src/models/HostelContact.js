import mongoose from 'mongoose';
import {
  CONTACT_CATEGORY_VALUES,
  CONTACT_CATEGORIES,
} from '../constants/studentServices.constants.js';

const hostelContactSchema = new mongoose.Schema(
  {
    contactId: {
      type: String,
      required: [true, 'Contact ID is required'],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    hostelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hostel',
      default: null, // null means campus-wide contact
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Contact designation / desk title is required'],
      trim: true,
      minlength: [2, 'Title must be at least 2 characters'],
      maxlength: [120, 'Title cannot exceed 120 characters'],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: CONTACT_CATEGORY_VALUES,
      default: CONTACT_CATEGORIES.ADMINISTRATION,
      index: true,
    },
    contactPerson: {
      type: String,
      trim: true,
      default: '',
    },
    phoneNumber: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
    },
    altPhoneNumber: {
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
    availableHours: {
      type: String,
      trim: true,
      default: '24x7',
    },
    location: {
      type: String,
      trim: true,
      default: 'Main Office',
    },
    isEmergency: {
      type: Boolean,
      default: false,
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
  },
  {
    timestamps: true,
  }
);

const HostelContact =
  mongoose.models.HostelContact ||
  mongoose.model('HostelContact', hostelContactSchema);

export default HostelContact;
