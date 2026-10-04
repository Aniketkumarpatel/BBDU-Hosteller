import mongoose from 'mongoose';
import {
  EXPENSE_CATEGORY_VALUES,
  EXPENSE_STATUS_VALUES,
  EXPENSE_STATUSES,
} from '../constants/finance.constants.js';

const expenseAuditSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      trim: true,
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    previousStatus: {
      type: String,
      default: null,
    },
    newStatus: {
      type: String,
      default: null,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const hostelExpenseSchema = new mongoose.Schema(
  {
    expenseId: {
      type: String,
      required: [true, 'Expense ID is required'],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    financialYear: {
      type: String,
      required: [true, 'Financial Year is required'],
      trim: true,
      uppercase: true,
      index: true,
    },
    hostelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hostel',
      required: [true, 'Hostel ID is required'],
      index: true,
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null,
      index: true,
    },
    category: {
      type: String,
      required: [true, 'Expense category is required'],
      enum: EXPENSE_CATEGORY_VALUES,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Expense title is required'],
      trim: true,
      minlength: [3, 'Title must be at least 3 characters'],
      maxlength: [180, 'Title cannot exceed 180 characters'],
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    amount: {
      type: Number,
      required: [true, 'Expense amount is required'],
      min: [0.01, 'Expense amount must be greater than zero'],
    },
    expenseDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    invoiceNumber: {
      type: String,
      trim: true,
      default: '',
    },
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      default: null,
      index: true,
    },
    assetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Asset',
      default: null,
      index: true,
    },
    workOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MaintenanceWorkOrder',
      default: null,
      index: true,
    },
    maintenancePlanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MaintenancePlan',
      default: null,
      index: true,
    },
    cleaningTaskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CleaningTask',
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: EXPENSE_STATUS_VALUES,
      default: EXPENSE_STATUSES.DRAFT,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    submittedAt: {
      type: Date,
      default: null,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      trim: true,
      default: '',
    },
    cancellationReason: {
      type: String,
      trim: true,
      default: '',
    },
    auditTrail: [expenseAuditSchema],
  },
  {
    timestamps: true,
  }
);

// Indexes for common queries
hostelExpenseSchema.index({ hostelId: 1, financialYear: 1, category: 1, status: 1 });
hostelExpenseSchema.index({ createdBy: 1, status: 1 });

const HostelExpense =
  mongoose.models.HostelExpense ||
  mongoose.model('HostelExpense', hostelExpenseSchema);

export default HostelExpense;
