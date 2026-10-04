import mongoose from 'mongoose';
import { EXPENSE_CATEGORY_VALUES } from '../constants/finance.constants.js';

const hostelBudgetSchema = new mongoose.Schema(
  {
    budgetId: {
      type: String,
      required: [true, 'Budget ID is required'],
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
      required: [true, 'Budget category is required'],
      enum: EXPENSE_CATEGORY_VALUES,
      index: true,
    },
    allocatedAmount: {
      type: Number,
      required: [true, 'Allocated amount is required'],
      min: [0, 'Allocated amount cannot be negative'],
    },
    revisedAmount: {
      type: Number,
      min: [0, 'Revised amount cannot be negative'],
      default: null,
    },
    utilizedAmount: {
      type: Number,
      default: 0,
      min: [0, 'Utilized amount cannot be negative'],
    },
    remainingAmount: {
      type: Number,
      default: function () {
        const effective = this.revisedAmount != null ? this.revisedAmount : this.allocatedAmount;
        return effective - (this.utilizedAmount || 0);
      },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
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

// Compound unique index ensuring one budget per category per financial year per hostel
hostelBudgetSchema.index(
  { hostelId: 1, financialYear: 1, category: 1 },
  { unique: true }
);

// Synchronous pre-save hook to recalculate remainingAmount
hostelBudgetSchema.pre('save', function () {
  const effective = this.revisedAmount != null ? this.revisedAmount : this.allocatedAmount;
  this.remainingAmount = effective - (this.utilizedAmount || 0);
});

const HostelBudget =
  mongoose.models.HostelBudget ||
  mongoose.model('HostelBudget', hostelBudgetSchema);

export default HostelBudget;
