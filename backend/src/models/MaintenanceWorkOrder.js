import mongoose from 'mongoose';
import {
  WORK_ORDER_STATUS_VALUES,
  WORK_ORDER_STATUSES,
  WORK_ORDER_PRIORITY_VALUES,
  WORK_ORDER_PRIORITIES,
} from '../constants/workOrder.constants.js';
import { COMPLAINT_CATEGORY_VALUES } from '../constants/complaint.constants.js';
import { SLA_STATUS_VALUES } from '../constants/sla.constants.js';

const workOrderAuditSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      trim: true,
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    previousStatus: {
      type: String,
      default: null,
    },
    newStatus: {
      type: String,
      default: null,
    },
    note: {
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

const maintenanceWorkOrderSchema = new mongoose.Schema(
  {
    workOrderId: {
      type: String,
      required: [true, 'Work Order ID is required'],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    complaintId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Complaint',
      default: null,
      index: true,
    },
    assetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Asset',
      default: null,
      index: true,
    },
    maintenancePlanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MaintenancePlan',
      default: null,
      index: true,
    },
    maintenanceCycleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MaintenanceCycle',
      default: null,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Work order title is required'],
      trim: true,
      minlength: [3, 'Title must be at least 3 characters'],
      maxlength: [150, 'Title cannot exceed 150 characters'],
    },
    description: {
      type: String,
      required: [true, 'Work order description is required'],
      trim: true,
      minlength: [5, 'Description must be at least 5 characters'],
      maxlength: [3000, 'Description cannot exceed 3000 characters'],
    },
    category: {
      type: String,
      enum: {
        values: [...COMPLAINT_CATEGORY_VALUES, null],
        message: 'Invalid work order category',
      },
      default: null,
    },
    hostelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hostel',
      required: [true, 'Hostel reference is required'],
      index: true,
    },
    blockId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Block',
      default: null,
    },
    floorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Floor',
      default: null,
    },
    roomId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      default: null,
      index: true,
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: [true, 'Department reference is required'],
      index: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Creator reference is required'],
      index: true,
    },
    priority: {
      type: String,
      required: true,
      enum: {
        values: WORK_ORDER_PRIORITY_VALUES,
        message: 'Invalid work order priority',
      },
      default: WORK_ORDER_PRIORITIES.MEDIUM,
      index: true,
    },
    status: {
      type: String,
      required: true,
      enum: {
        values: WORK_ORDER_STATUS_VALUES,
        message: 'Invalid work order status',
      },
      default: WORK_ORDER_STATUSES.CREATED,
      index: true,
    },
    dueAt: {
      type: Date,
      default: null,
      index: true,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    completionNote: {
      type: String,
      trim: true,
      maxlength: [2000, 'Completion note cannot exceed 2000 characters'],
      default: '',
    },
    // Repair & Maintenance Cost Tracking (Step 14)
    laborCost: {
      type: Number,
      min: [0, 'Labor cost cannot be negative'],
      default: 0,
    },
    partsCost: {
      type: Number,
      min: [0, 'Parts cost cannot be negative'],
      default: 0,
    },
    serviceCost: {
      type: Number,
      min: [0, 'Service cost cannot be negative'],
      default: 0,
    },
    otherCost: {
      type: Number,
      min: [0, 'Other cost cannot be negative'],
      default: 0,
    },
    totalCost: {
      type: Number,
      min: [0, 'Total cost cannot be negative'],
      default: 0,
    },
    holdReason: {
      type: String,
      trim: true,
      maxlength: [1000, 'Hold reason cannot exceed 1000 characters'],
      default: '',
    },
    cancellationReason: {
      type: String,
      trim: true,
      maxlength: [1000, 'Cancellation reason cannot exceed 1000 characters'],
      default: '',
    },
    // SLA Tracking Fields
    slaRuleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SlaRule',
      default: null,
    },
    slaStatus: {
      type: String,
      enum: {
        values: [...SLA_STATUS_VALUES, null],
        message: 'Invalid SLA status',
      },
      default: null,
      index: true,
    },
    slaStartedAt: {
      type: Date,
      default: null,
    },
    slaDueAt: {
      type: Date,
      default: null,
      index: true,
    },
    slaBreachedAt: {
      type: Date,
      default: null,
    },
    auditLog: [workOrderAuditSchema],
  },
  {
    timestamps: true,
  }
);

maintenanceWorkOrderSchema.index({ status: 1, departmentId: 1 });
maintenanceWorkOrderSchema.index({ assignedTo: 1, status: 1 });
maintenanceWorkOrderSchema.index({ complaintId: 1, createdAt: -1 });

const MaintenanceWorkOrder =
  mongoose.models.MaintenanceWorkOrder ||
  mongoose.model('MaintenanceWorkOrder', maintenanceWorkOrderSchema);

export default MaintenanceWorkOrder;
