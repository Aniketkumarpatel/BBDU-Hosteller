import mongoose from 'mongoose';
import {
  FINANCIAL_YEAR_STATUS_VALUES,
  FINANCIAL_YEAR_STATUSES,
} from '../constants/finance.constants.js';

const financialYearSchema = new mongoose.Schema(
  {
    financialYear: {
      type: String,
      required: [true, 'Financial Year is required (e.g. 2026-27)'],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required'],
    },
    status: {
      type: String,
      enum: FINANCIAL_YEAR_STATUS_VALUES,
      default: FINANCIAL_YEAR_STATUSES.OPEN,
      index: true,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    closedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    closedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const FinancialYear =
  mongoose.models.FinancialYear ||
  mongoose.model('FinancialYear', financialYearSchema);

export default FinancialYear;
