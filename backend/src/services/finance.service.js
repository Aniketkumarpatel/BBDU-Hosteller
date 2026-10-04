import mongoose from 'mongoose';
import {
  FinancialYear,
  HostelBudget,
  Vendor,
  HostelExpense,
  Hostel,
  Department,
  User,
  MaintenanceWorkOrder,
  Asset,
  MaintenancePlan,
  CleaningTask,
} from '../models/index.js';
import Counter, { getNextSequence } from '../models/Counter.js';
import ApiError from '../utils/ApiError.js';
import { ROLES } from '../constants/roles.js';
import {
  FINANCIAL_YEAR_STATUSES,
  EXPENSE_STATUSES,
  EXPENSE_CATEGORY_VALUES,
  VENDOR_SERVICE_CATEGORY_VALUES,
  FINANCE_THRESHOLDS,
} from '../constants/finance.constants.js';
import { createNotification } from './notification.service.js';
import {
  NOTIFICATION_TYPES,
  NOTIFICATION_ENTITY_TYPES,
} from '../constants/notification.constants.js';

// ============================================================================
// Helper Utilities & Sequence Generators
// ============================================================================

export const generateExpenseId = async () => {
  const year = new Date().getFullYear();
  const seq = await getNextSequence(`expense_${year}`);
  return `EXP-${year}-${String(seq).padStart(5, '0')}`;
};

export const generateBudgetId = async () => {
  const year = new Date().getFullYear();
  const seq = await getNextSequence(`budget_${year}`);
  return `BDG-${year}-${String(seq).padStart(5, '0')}`;
};

export const generateVendorId = async () => {
  const year = new Date().getFullYear();
  const seq = await getNextSequence(`vendor_${year}`);
  return `VND-${year}-${String(seq).padStart(5, '0')}`;
};

/**
 * Validate that a financial year is OPEN
 */
export const validateFinancialYearOpen = async (financialYearStr) => {
  if (!financialYearStr) return;
  const fy = await FinancialYear.findOne({ financialYear: financialYearStr.trim().toUpperCase() });
  if (fy && fy.status === FINANCIAL_YEAR_STATUSES.CLOSED) {
    throw ApiError.badRequest(
      `Financial Year ${financialYearStr} is CLOSED. Operational financial transactions are not permitted.`
    );
  }
};

/**
 * Enforce RBAC & Hostel Data Isolation
 */
export const enforceHostelAccess = (user, targetHostelId) => {
  if (!user) throw ApiError.unauthorized('Authentication required');

  if (user.role === ROLES.STUDENT) {
    throw ApiError.forbidden('Students do not have access to financial and expense management.');
  }

  if (user.role === ROLES.HOSTEL_STAFF || user.role === ROLES.WARDEN) {
    const userHostelId = user.hostelId?._id ? user.hostelId._id.toString() : user.hostelId?.toString();
    const targetId = targetHostelId?._id ? targetHostelId._id.toString() : targetHostelId?.toString();

    if (!userHostelId || userHostelId !== targetId) {
      throw ApiError.forbidden('Access denied. You can only manage financial records for your assigned hostel.');
    }
  }
};

// ============================================================================
// 1. FINANCIAL YEAR MANAGEMENT
// ============================================================================

export const getFinancialYears = async () => {
  return FinancialYear.find().sort({ startDate: -1 }).populate('createdBy', 'name email').lean();
};

export const createFinancialYear = async (data, user) => {
  if (![ROLES.SUPER_ADMIN, ROLES.AUTHORITY].includes(user.role)) {
    throw ApiError.forbidden('Only Super Admin or Campus Authority can define financial years.');
  }

  const { financialYear, startDate, endDate, notes } = data;
  if (!financialYear || !startDate || !endDate) {
    throw ApiError.badRequest('financialYear, startDate, and endDate are required.');
  }

  const cleanYear = financialYear.trim().toUpperCase();
  const existing = await FinancialYear.findOne({ financialYear: cleanYear });
  if (existing) {
    throw ApiError.conflict(`Financial Year ${cleanYear} already exists.`);
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (end <= start) {
    throw ApiError.badRequest('End date must be after start date.');
  }

  const fy = await FinancialYear.create({
    financialYear: cleanYear,
    startDate: start,
    endDate: end,
    notes: notes || '',
    createdBy: user._id,
  });

  return fy;
};

export const closeFinancialYear = async (id, user) => {
  if (![ROLES.SUPER_ADMIN, ROLES.AUTHORITY].includes(user.role)) {
    throw ApiError.forbidden('Only Super Admin or Campus Authority can close financial years.');
  }

  const fy = await FinancialYear.findById(id);
  if (!fy) throw ApiError.notFound('Financial Year not found.');

  fy.status = FINANCIAL_YEAR_STATUSES.CLOSED;
  fy.closedBy = user._id;
  fy.closedAt = new Date();
  await fy.save();

  return fy;
};

export const reopenFinancialYear = async (id, user) => {
  if (user.role !== ROLES.SUPER_ADMIN) {
    throw ApiError.forbidden('Only Super Admin can reopen closed financial years.');
  }

  const fy = await FinancialYear.findById(id);
  if (!fy) throw ApiError.notFound('Financial Year not found.');

  fy.status = FINANCIAL_YEAR_STATUSES.OPEN;
  fy.closedBy = null;
  fy.closedAt = null;
  await fy.save();

  return fy;
};

// ============================================================================
// 2. BUDGET MANAGEMENT
// ============================================================================

export const createBudget = async (data, user) => {
  if (![ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN].includes(user.role)) {
    throw ApiError.forbidden('Insufficient permissions to allocate operational budgets.');
  }

  const { hostelId, financialYear, category, allocatedAmount, departmentId, notes } = data;

  if (!hostelId || !financialYear || !category || allocatedAmount == null) {
    throw ApiError.badRequest('hostelId, financialYear, category, and allocatedAmount are required.');
  }

  enforceHostelAccess(user, hostelId);
  await validateFinancialYearOpen(financialYear);

  if (!EXPENSE_CATEGORY_VALUES.includes(category)) {
    throw ApiError.badRequest(`Invalid budget category: ${category}`);
  }

  const numAllocated = Number(allocatedAmount);
  if (isNaN(numAllocated) || numAllocated < 0) {
    throw ApiError.badRequest('Allocated amount must be a non-negative number.');
  }

  // Prevent duplicate category budget in same financial year and hostel
  const cleanYear = financialYear.trim().toUpperCase();
  const existing = await HostelBudget.findOne({
    hostelId,
    financialYear: cleanYear,
    category,
  });

  if (existing) {
    throw ApiError.conflict(
      `Budget for category ${category} already exists for Hostel in Financial Year ${cleanYear}. Use revise budget instead.`
    );
  }

  const budgetId = await generateBudgetId();

  const budget = await HostelBudget.create({
    budgetId,
    hostelId,
    financialYear: cleanYear,
    category,
    allocatedAmount: numAllocated,
    departmentId: departmentId || null,
    notes: notes || '',
    createdBy: user._id,
  });

  return budget.populate([
    { path: 'hostelId', select: 'name code' },
    { path: 'departmentId', select: 'name code' },
    { path: 'createdBy', select: 'name email role' },
  ]);
};

export const getBudgets = async (query = {}, user) => {
  if (user.role === ROLES.STUDENT) {
    throw ApiError.forbidden('Students do not have access to financial data.');
  }

  const filter = {};

  if (user.role === ROLES.WARDEN || user.role === ROLES.HOSTEL_STAFF) {
    filter.hostelId = user.hostelId;
  } else if (query.hostelId) {
    filter.hostelId = query.hostelId;
  }

  if (query.financialYear) filter.financialYear = query.financialYear.trim().toUpperCase();
  if (query.category) filter.category = query.category;

  const budgets = await HostelBudget.find(filter)
    .populate('hostelId', 'name code')
    .populate('departmentId', 'name code')
    .populate('createdBy', 'name email role')
    .populate('updatedBy', 'name email role')
    .sort({ financialYear: -1, category: 1 })
    .lean();

  return budgets;
};

export const updateBudget = async (id, data, user) => {
  if (![ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN].includes(user.role)) {
    throw ApiError.forbidden('Insufficient permissions to revise operational budgets.');
  }

  const budget = await HostelBudget.findById(id);
  if (!budget) throw ApiError.notFound('Budget record not found.');

  enforceHostelAccess(user, budget.hostelId);
  await validateFinancialYearOpen(budget.financialYear);

  if (data.revisedAmount != null) {
    const numRevised = Number(data.revisedAmount);
    if (isNaN(numRevised) || numRevised < 0) {
      throw ApiError.badRequest('Revised amount must be a non-negative number.');
    }
    budget.revisedAmount = numRevised;
  }

  if (data.notes !== undefined) budget.notes = data.notes;
  budget.updatedBy = user._id;

  await budget.save();

  return budget.populate([
    { path: 'hostelId', select: 'name code' },
    { path: 'departmentId', select: 'name code' },
    { path: 'updatedBy', select: 'name email role' },
  ]);
};

export const getBudgetUtilization = async (params = {}, user) => {
  if (user.role === ROLES.STUDENT) {
    throw ApiError.forbidden('Access denied.');
  }

  const filter = {};
  if (user.role === ROLES.WARDEN || user.role === ROLES.HOSTEL_STAFF) {
    filter.hostelId = user.hostelId;
  } else if (params.hostelId) {
    filter.hostelId = new mongoose.Types.ObjectId(params.hostelId);
  }

  if (params.financialYear) {
    filter.financialYear = params.financialYear.trim().toUpperCase();
  }

  const budgets = await HostelBudget.find(filter)
    .populate('hostelId', 'name code')
    .lean();

  let totalAllocated = 0;
  let totalRevised = 0;
  let totalEffective = 0;
  let totalUtilized = 0;
  let totalRemaining = 0;

  const categoryBreakdown = {};

  budgets.forEach((b) => {
    const effective = b.revisedAmount != null ? b.revisedAmount : b.allocatedAmount;
    totalAllocated += b.allocatedAmount;
    if (b.revisedAmount != null) totalRevised += b.revisedAmount;
    totalEffective += effective;
    totalUtilized += b.utilizedAmount || 0;
    totalRemaining += b.remainingAmount || (effective - (b.utilizedAmount || 0));

    if (!categoryBreakdown[b.category]) {
      categoryBreakdown[b.category] = {
        category: b.category,
        allocatedAmount: 0,
        utilizedAmount: 0,
        remainingAmount: 0,
        utilizationPercent: 0,
      };
    }

    categoryBreakdown[b.category].allocatedAmount += effective;
    categoryBreakdown[b.category].utilizedAmount += b.utilizedAmount || 0;
    categoryBreakdown[b.category].remainingAmount += b.remainingAmount || (effective - (b.utilizedAmount || 0));
  });

  Object.values(categoryBreakdown).forEach((cat) => {
    cat.utilizationPercent =
      cat.allocatedAmount > 0
        ? Math.round((cat.utilizedAmount / cat.allocatedAmount) * 100)
        : 0;
  });

  const overallUtilizationPercent =
    totalEffective > 0 ? Math.round((totalUtilized / totalEffective) * 100) : 0;

  return {
    financialYear: params.financialYear || 'ALL',
    totalBudgetsCount: budgets.length,
    totalAllocated,
    totalRevised,
    totalEffective,
    totalUtilized,
    totalRemaining,
    overallUtilizationPercent,
    categoryBreakdown: Object.values(categoryBreakdown),
  };
};

// ============================================================================
// 3. VENDOR MANAGEMENT
// ============================================================================

export const createVendor = async (data, user) => {
  if (![ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN].includes(user.role)) {
    throw ApiError.forbidden('Insufficient permissions to register vendors.');
  }

  const { name, serviceCategory, contactName, phone, email, address, vendorCode, hostelId, notes } = data;
  if (!name || !serviceCategory) {
    throw ApiError.badRequest('Vendor name and serviceCategory are required.');
  }

  if (!VENDOR_SERVICE_CATEGORY_VALUES.includes(serviceCategory)) {
    throw ApiError.badRequest(`Invalid serviceCategory: ${serviceCategory}`);
  }

  if (hostelId) {
    enforceHostelAccess(user, hostelId);
  }

  const vendorId = await generateVendorId();

  const vendor = await Vendor.create({
    vendorId,
    vendorCode: vendorCode ? vendorCode.trim().toUpperCase() : undefined,
    name: name.trim(),
    serviceCategory,
    contactName: contactName || '',
    phone: phone || '',
    email: email || '',
    address: address || '',
    hostelId: hostelId || (user.role === ROLES.WARDEN ? user.hostelId : null),
    notes: notes || '',
    createdBy: user._id,
  });

  return vendor;
};

export const getVendors = async (query = {}, user) => {
  if (user.role === ROLES.STUDENT) throw ApiError.forbidden('Access denied.');

  const filter = {};
  if (query.serviceCategory) filter.serviceCategory = query.serviceCategory;
  if (query.isActive !== undefined) filter.isActive = query.isActive === 'true';

  if (user.role === ROLES.WARDEN || user.role === ROLES.HOSTEL_STAFF) {
    filter.$or = [{ hostelId: user.hostelId }, { hostelId: null }];
  } else if (query.hostelId) {
    filter.$or = [{ hostelId: query.hostelId }, { hostelId: null }];
  }

  if (query.search) {
    filter.$or = [
      { name: { $regex: query.search, $options: 'i' } },
      { vendorId: { $regex: query.search, $options: 'i' } },
      { contactName: { $regex: query.search, $options: 'i' } },
    ];
  }

  return Vendor.find(filter).sort({ name: 1 }).lean();
};

export const getVendorById = async (id, user) => {
  if (user.role === ROLES.STUDENT) throw ApiError.forbidden('Access denied.');
  const vendor = await Vendor.findById(id).lean();
  if (!vendor) throw ApiError.notFound('Vendor not found.');
  return vendor;
};

export const updateVendor = async (id, data, user) => {
  if (![ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN].includes(user.role)) {
    throw ApiError.forbidden('Insufficient permissions to update vendors.');
  }

  const vendor = await Vendor.findById(id);
  if (!vendor) throw ApiError.notFound('Vendor not found.');

  if (vendor.hostelId) enforceHostelAccess(user, vendor.hostelId);

  const allowedFields = ['name', 'serviceCategory', 'contactName', 'phone', 'email', 'address', 'isActive', 'notes'];
  allowedFields.forEach((field) => {
    if (data[field] !== undefined) vendor[field] = data[field];
  });

  await vendor.save();
  return vendor;
};

export const deleteVendor = async (id, user) => {
  if (![ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN].includes(user.role)) {
    throw ApiError.forbidden('Insufficient permissions.');
  }

  const vendor = await Vendor.findById(id);
  if (!vendor) throw ApiError.notFound('Vendor not found.');

  if (vendor.hostelId) enforceHostelAccess(user, vendor.hostelId);

  // Soft delete if historical expenses reference this vendor
  const hasExpenses = await HostelExpense.exists({ vendorId: id });
  if (hasExpenses) {
    vendor.isActive = false;
    await vendor.save();
    return { success: true, message: 'Vendor has historical expense records and was marked inactive.' };
  }

  await Vendor.findByIdAndDelete(id);
  return { success: true, message: 'Vendor deleted successfully.' };
};

// ============================================================================
// 4. EXPENSE MANAGEMENT & WORKFLOW
// ============================================================================

export const createExpense = async (data, user) => {
  if (![ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN, ROLES.HOSTEL_STAFF].includes(user.role)) {
    throw ApiError.forbidden('Insufficient permissions to create operational expense records.');
  }

  const {
    hostelId,
    financialYear,
    category,
    title,
    description,
    amount,
    expenseDate,
    invoiceNumber,
    vendorId,
    assetId,
    workOrderId,
    maintenancePlanId,
    cleaningTaskId,
    departmentId,
  } = data;

  if (!hostelId || !financialYear || !category || !title || amount == null) {
    throw ApiError.badRequest('hostelId, financialYear, category, title, and amount are required.');
  }

  enforceHostelAccess(user, hostelId);
  await validateFinancialYearOpen(financialYear);

  if (!EXPENSE_CATEGORY_VALUES.includes(category)) {
    throw ApiError.badRequest(`Invalid expense category: ${category}`);
  }

  const numAmount = Number(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    throw ApiError.badRequest('Expense amount must be a positive number greater than zero.');
  }

  // Verify operational links if provided
  if (workOrderId) {
    const wo = await MaintenanceWorkOrder.findById(workOrderId);
    if (!wo) throw ApiError.notFound('Referenced work order not found.');
    if (wo.hostelId.toString() !== hostelId.toString()) {
      throw ApiError.badRequest('Referenced work order belongs to a different hostel.');
    }
  }

  if (assetId) {
    const ast = await Asset.findById(assetId);
    if (!ast) throw ApiError.notFound('Referenced asset not found.');
    if (ast.hostelId.toString() !== hostelId.toString()) {
      throw ApiError.badRequest('Referenced asset belongs to a different hostel.');
    }
  }

  if (maintenancePlanId) {
    const plan = await MaintenancePlan.findById(maintenancePlanId);
    if (!plan) throw ApiError.notFound('Referenced maintenance plan not found.');
  }

  if (cleaningTaskId) {
    const ct = await CleaningTask.findById(cleaningTaskId);
    if (!ct) throw ApiError.notFound('Referenced cleaning task not found.');
  }

  if (vendorId) {
    const v = await Vendor.findById(vendorId);
    if (!v) throw ApiError.notFound('Referenced vendor not found.');
  }

  const expenseId = await generateExpenseId();
  const cleanYear = financialYear.trim().toUpperCase();

  const expense = await HostelExpense.create({
    expenseId,
    financialYear: cleanYear,
    hostelId,
    departmentId: departmentId || null,
    category,
    title: title.trim(),
    description: description || '',
    amount: numAmount,
    expenseDate: expenseDate ? new Date(expenseDate) : new Date(),
    invoiceNumber: invoiceNumber ? invoiceNumber.trim() : '',
    vendorId: vendorId || null,
    assetId: assetId || null,
    workOrderId: workOrderId || null,
    maintenancePlanId: maintenancePlanId || null,
    cleaningTaskId: cleaningTaskId || null,
    status: EXPENSE_STATUSES.DRAFT,
    createdBy: user._id,
    auditTrail: [
      {
        action: 'CREATED_DRAFT',
        previousStatus: null,
        newStatus: EXPENSE_STATUSES.DRAFT,
        performedBy: user._id,
        notes: 'Operational expense record initiated as draft.',
        timestamp: new Date(),
      },
    ],
  });

  return expense.populate([
    { path: 'hostelId', select: 'name code' },
    { path: 'vendorId', select: 'name serviceCategory vendorId' },
    { path: 'assetId', select: 'name assetId assetCode' },
    { path: 'workOrderId', select: 'workOrderId title' },
    { path: 'createdBy', select: 'name email role' },
  ]);
};

export const getExpenses = async (query = {}, user) => {
  if (user.role === ROLES.STUDENT) {
    throw ApiError.forbidden('Students do not have access to financial records.');
  }

  const filter = {};

  if (user.role === ROLES.WARDEN || user.role === ROLES.HOSTEL_STAFF) {
    filter.hostelId = user.hostelId;
  } else if (query.hostelId) {
    filter.hostelId = query.hostelId;
  }

  if (query.financialYear) filter.financialYear = query.financialYear.trim().toUpperCase();
  if (query.category) filter.category = query.category;
  if (query.status) filter.status = query.status;
  if (query.vendorId) filter.vendorId = query.vendorId;
  if (query.assetId) filter.assetId = query.assetId;
  if (query.workOrderId) filter.workOrderId = query.workOrderId;

  if (query.startDate || query.endDate) {
    filter.expenseDate = {};
    if (query.startDate) filter.expenseDate.$gte = new Date(query.startDate);
    if (query.endDate) filter.expenseDate.$lte = new Date(query.endDate);
  }

  if (query.search) {
    filter.$or = [
      { title: { $regex: query.search, $options: 'i' } },
      { expenseId: { $regex: query.search, $options: 'i' } },
      { invoiceNumber: { $regex: query.search, $options: 'i' } },
    ];
  }

  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  const skip = (page - 1) * limit;

  const [expenses, total] = await Promise.all([
    HostelExpense.find(filter)
      .populate('hostelId', 'name code')
      .populate('vendorId', 'name serviceCategory vendorId')
      .populate('assetId', 'name assetId assetCode')
      .populate('workOrderId', 'workOrderId title')
      .populate('createdBy', 'name email role')
      .populate('approvedBy', 'name email role')
      .sort({ expenseDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    HostelExpense.countDocuments(filter),
  ]);

  return {
    expenses,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

export const getExpenseById = async (id, user) => {
  if (user.role === ROLES.STUDENT) throw ApiError.forbidden('Access denied.');

  const expense = await HostelExpense.findById(id)
    .populate('hostelId', 'name code')
    .populate('departmentId', 'name code')
    .populate('vendorId', 'name serviceCategory vendorId contactName phone email')
    .populate('assetId', 'name assetId assetCode condition status totalMaintenanceCost')
    .populate('workOrderId', 'workOrderId title status priority laborCost partsCost serviceCost totalCost')
    .populate('maintenancePlanId', 'planId title frequency')
    .populate('cleaningTaskId', 'taskId title status')
    .populate('createdBy', 'name email role')
    .populate('reviewedBy', 'name email role')
    .populate('approvedBy', 'name email role')
    .populate('auditTrail.performedBy', 'name email role')
    .lean();

  if (!expense) throw ApiError.notFound('Expense record not found.');

  enforceHostelAccess(user, expense.hostelId);

  return expense;
};

export const updateExpense = async (id, data, user) => {
  const expense = await HostelExpense.findById(id);
  if (!expense) throw ApiError.notFound('Expense not found.');

  enforceHostelAccess(user, expense.hostelId);
  await validateFinancialYearOpen(expense.financialYear);

  if (![EXPENSE_STATUSES.DRAFT, EXPENSE_STATUSES.REJECTED].includes(expense.status)) {
    throw ApiError.badRequest('Only expenses in DRAFT or REJECTED status can be modified.');
  }

  // Must be creator or Warden/Admin
  if (
    expense.createdBy.toString() !== user._id.toString() &&
    ![ROLES.WARDEN, ROLES.SUPER_ADMIN, ROLES.AUTHORITY].includes(user.role)
  ) {
    throw ApiError.forbidden('Only the creator or authorized management can edit this expense draft.');
  }

  const allowedUpdates = ['title', 'description', 'amount', 'expenseDate', 'invoiceNumber', 'vendorId', 'category'];
  allowedUpdates.forEach((f) => {
    if (data[f] !== undefined) expense[f] = data[f];
  });

  if (expense.isModified('amount')) {
    const num = Number(expense.amount);
    if (isNaN(num) || num <= 0) throw ApiError.badRequest('Amount must be positive.');
    expense.amount = num;
  }

  expense.auditTrail.push({
    action: 'UPDATED',
    previousStatus: expense.status,
    newStatus: expense.status,
    performedBy: user._id,
    notes: 'Expense details updated.',
    timestamp: new Date(),
  });

  await expense.save();
  return expense;
};

export const submitExpense = async (id, user) => {
  const expense = await HostelExpense.findById(id);
  if (!expense) throw ApiError.notFound('Expense not found.');

  enforceHostelAccess(user, expense.hostelId);
  await validateFinancialYearOpen(expense.financialYear);

  if (expense.status !== EXPENSE_STATUSES.DRAFT && expense.status !== EXPENSE_STATUSES.REJECTED) {
    throw ApiError.badRequest(`Cannot submit expense currently in status: ${expense.status}`);
  }

  expense.status = EXPENSE_STATUSES.SUBMITTED;
  expense.submittedAt = new Date();
  expense.auditTrail.push({
    action: 'SUBMITTED',
    previousStatus: expense.status,
    newStatus: EXPENSE_STATUSES.SUBMITTED,
    performedBy: user._id,
    notes: 'Submitted for warden/authority review and approval.',
    timestamp: new Date(),
  });

  await expense.save();

  // Notify Warden
  const warden = await User.findOne({ role: ROLES.WARDEN, hostelId: expense.hostelId, isActive: true });
  if (warden && warden._id.toString() !== user._id.toString()) {
    await createNotification({
      recipient: warden._id,
      type: NOTIFICATION_TYPES.EXPENSE_SUBMITTED,
      title: 'New Expense Submitted for Review',
      message: `Expense ${expense.expenseId} ("${expense.title}") for ₹${expense.amount} submitted by ${user.name}.`,
      relatedEntityType: NOTIFICATION_ENTITY_TYPES.EXPENSE,
      relatedEntityId: expense._id,
    }).catch(() => {});
  }

  return expense;
};

export const reviewExpense = async (id, user) => {
  if (![ROLES.WARDEN, ROLES.AUTHORITY, ROLES.SUPER_ADMIN].includes(user.role)) {
    throw ApiError.forbidden('Only Warden, Authority, or Super Admin can mark expenses as under review.');
  }

  const expense = await HostelExpense.findById(id);
  if (!expense) throw ApiError.notFound('Expense not found.');

  enforceHostelAccess(user, expense.hostelId);
  await validateFinancialYearOpen(expense.financialYear);

  if (expense.status !== EXPENSE_STATUSES.SUBMITTED) {
    throw ApiError.badRequest(`Cannot review expense in ${expense.status} status.`);
  }

  expense.status = EXPENSE_STATUSES.UNDER_REVIEW;
  expense.reviewedBy = user._id;
  expense.reviewedAt = new Date();
  expense.auditTrail.push({
    action: 'MARKED_UNDER_REVIEW',
    previousStatus: EXPENSE_STATUSES.SUBMITTED,
    newStatus: EXPENSE_STATUSES.UNDER_REVIEW,
    performedBy: user._id,
    notes: 'Expense placed under administrative review.',
    timestamp: new Date(),
  });

  await expense.save();
  return expense;
};

export const approveExpense = async (id, user) => {
  if (![ROLES.WARDEN, ROLES.AUTHORITY, ROLES.SUPER_ADMIN].includes(user.role)) {
    throw ApiError.forbidden('Insufficient permissions to approve expenses.');
  }

  const expense = await HostelExpense.findById(id);
  if (!expense) throw ApiError.notFound('Expense not found.');

  enforceHostelAccess(user, expense.hostelId);
  await validateFinancialYearOpen(expense.financialYear);

  // Self-approval guard: User cannot approve their own expense
  if (expense.createdBy.toString() === user._id.toString() && user.role !== ROLES.SUPER_ADMIN) {
    throw ApiError.forbidden('Self-approval guard: You cannot approve your own expense request.');
  }

  if (![EXPENSE_STATUSES.SUBMITTED, EXPENSE_STATUSES.UNDER_REVIEW].includes(expense.status)) {
    throw ApiError.badRequest(`Cannot approve expense in status ${expense.status}. Must be SUBMITTED or UNDER_REVIEW.`);
  }

  expense.status = EXPENSE_STATUSES.APPROVED;
  expense.approvedBy = user._id;
  expense.approvedAt = new Date();
  expense.auditTrail.push({
    action: 'APPROVED',
    previousStatus: expense.status,
    newStatus: EXPENSE_STATUSES.APPROVED,
    performedBy: user._id,
    notes: `Expense approved by ${user.name} (${user.role}).`,
    timestamp: new Date(),
  });

  await expense.save();

  // Atomically update matching HostelBudget utilization
  const budget = await HostelBudget.findOne({
    hostelId: expense.hostelId,
    financialYear: expense.financialYear,
    category: expense.category,
  });

  if (budget) {
    budget.utilizedAmount = (budget.utilizedAmount || 0) + expense.amount;
    const effective = budget.revisedAmount != null ? budget.revisedAmount : budget.allocatedAmount;
    budget.remainingAmount = effective - budget.utilizedAmount;
    budget.updatedBy = user._id;
    await budget.save();

    // Check threshold alerts
    const utilizationRatio = effective > 0 ? (budget.utilizedAmount / effective) : 1;
    if (utilizationRatio > 1.0) {
      // Overrun alert
      await createNotification({
        recipient: user._id,
        type: NOTIFICATION_TYPES.BUDGET_OVERRUN_ALERT,
        title: `Budget Exceeded: ${expense.category}`,
        message: `Budget for category ${expense.category} in ${expense.financialYear} has been exceeded (Utilized: ₹${budget.utilizedAmount} / Allocated: ₹${effective}).`,
        relatedEntityType: NOTIFICATION_ENTITY_TYPES.BUDGET,
        relatedEntityId: budget._id,
      }).catch(() => {});
    } else if (utilizationRatio >= 0.8) {
      // 80% threshold warning
      await createNotification({
        recipient: user._id,
        type: NOTIFICATION_TYPES.BUDGET_THRESHOLD_WARNING,
        title: `Budget Warning: ${expense.category} (≥80%)`,
        message: `Budget for category ${expense.category} is at ${Math.round(utilizationRatio * 100)}% utilization.`,
        relatedEntityType: NOTIFICATION_ENTITY_TYPES.BUDGET,
        relatedEntityId: budget._id,
      }).catch(() => {});
    }
  }

  // Notify creator
  if (expense.createdBy.toString() !== user._id.toString()) {
    await createNotification({
      recipient: expense.createdBy,
      type: NOTIFICATION_TYPES.EXPENSE_APPROVED,
      title: 'Expense Request Approved',
      message: `Your expense ${expense.expenseId} ("${expense.title}") for ₹${expense.amount} was approved by ${user.name}.`,
      relatedEntityType: NOTIFICATION_ENTITY_TYPES.EXPENSE,
      relatedEntityId: expense._id,
    }).catch(() => {});
  }

  return expense;
};

export const rejectExpense = async (id, { reason }, user) => {
  if (![ROLES.WARDEN, ROLES.AUTHORITY, ROLES.SUPER_ADMIN].includes(user.role)) {
    throw ApiError.forbidden('Insufficient permissions to reject expenses.');
  }

  if (!reason || !reason.trim()) {
    throw ApiError.badRequest('Rejection reason is mandatory.');
  }

  const expense = await HostelExpense.findById(id);
  if (!expense) throw ApiError.notFound('Expense not found.');

  enforceHostelAccess(user, expense.hostelId);
  await validateFinancialYearOpen(expense.financialYear);

  if (![EXPENSE_STATUSES.SUBMITTED, EXPENSE_STATUSES.UNDER_REVIEW].includes(expense.status)) {
    throw ApiError.badRequest(`Cannot reject expense in status: ${expense.status}`);
  }

  const prevStatus = expense.status;
  expense.status = EXPENSE_STATUSES.REJECTED;
  expense.rejectionReason = reason.trim();
  expense.auditTrail.push({
    action: 'REJECTED',
    previousStatus: prevStatus,
    newStatus: EXPENSE_STATUSES.REJECTED,
    performedBy: user._id,
    notes: `Rejected by ${user.name}: ${reason.trim()}`,
    timestamp: new Date(),
  });

  await expense.save();

  // Notify creator
  await createNotification({
    recipient: expense.createdBy,
    type: NOTIFICATION_TYPES.EXPENSE_REJECTED,
    title: 'Expense Request Rejected',
    message: `Your expense ${expense.expenseId} was rejected. Reason: ${reason.trim()}`,
    relatedEntityType: NOTIFICATION_ENTITY_TYPES.EXPENSE,
    relatedEntityId: expense._id,
  }).catch(() => {});

  return expense;
};

export const cancelExpense = async (id, { reason }, user) => {
  const expense = await HostelExpense.findById(id);
  if (!expense) throw ApiError.notFound('Expense not found.');

  enforceHostelAccess(user, expense.hostelId);

  // Creator can cancel in DRAFT or SUBMITTED; Admin can cancel anytime
  const isCreator = expense.createdBy.toString() === user._id.toString();
  const isAdmin = [ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN].includes(user.role);

  if (!isCreator && !isAdmin) {
    throw ApiError.forbidden('You do not have permission to cancel this expense.');
  }

  if (expense.status === EXPENSE_STATUSES.CANCELLED) {
    throw ApiError.badRequest('Expense is already cancelled.');
  }

  const prevStatus = expense.status;

  // If was previously APPROVED, reverse the budget utilization
  if (prevStatus === EXPENSE_STATUSES.APPROVED) {
    const budget = await HostelBudget.findOne({
      hostelId: expense.hostelId,
      financialYear: expense.financialYear,
      category: expense.category,
    });
    if (budget) {
      budget.utilizedAmount = Math.max(0, (budget.utilizedAmount || 0) - expense.amount);
      const effective = budget.revisedAmount != null ? budget.revisedAmount : budget.allocatedAmount;
      budget.remainingAmount = effective - budget.utilizedAmount;
      budget.updatedBy = user._id;
      await budget.save();
    }
  }

  expense.status = EXPENSE_STATUSES.CANCELLED;
  expense.cancellationReason = reason ? reason.trim() : 'Cancelled by user.';
  expense.auditTrail.push({
    action: 'CANCELLED',
    previousStatus: prevStatus,
    newStatus: EXPENSE_STATUSES.CANCELLED,
    performedBy: user._id,
    notes: expense.cancellationReason,
    timestamp: new Date(),
  });

  await expense.save();
  return expense;
};

// ============================================================================
// 5. OPERATIONAL TRACEABILITY & FINANCIAL DASHBOARD
// ============================================================================

export const getOperationalTraceability = async (expenseId, user) => {
  if (user.role === ROLES.STUDENT) throw ApiError.forbidden('Access denied.');

  const expense = await HostelExpense.findById(expenseId)
    .populate('hostelId', 'name code')
    .populate('departmentId', 'name code')
    .populate('vendorId')
    .populate('assetId')
    .populate('workOrderId')
    .populate('maintenancePlanId')
    .populate('cleaningTaskId')
    .populate('createdBy', 'name email role')
    .populate('approvedBy', 'name email role')
    .lean();

  if (!expense) throw ApiError.notFound('Expense not found.');
  enforceHostelAccess(user, expense.hostelId);

  // Link to Work Order's Complaint if available
  let complaint = null;
  if (expense.workOrderId?.complaintId) {
    const { Complaint } = await import('../models/index.js');
    complaint = await Complaint.findById(expense.workOrderId.complaintId)
      .select('complaintId title category status priority createdAt')
      .lean();
  }

  return {
    expense: {
      expenseId: expense.expenseId,
      title: expense.title,
      amount: expense.amount,
      category: expense.category,
      status: expense.status,
      expenseDate: expense.expenseDate,
      financialYear: expense.financialYear,
      invoiceNumber: expense.invoiceNumber,
      hostel: expense.hostelId,
    },
    traceability: {
      vendor: expense.vendorId || null,
      asset: expense.assetId || null,
      workOrder: expense.workOrderId || null,
      complaint: complaint || null,
      maintenancePlan: expense.maintenancePlanId || null,
      cleaningTask: expense.cleaningTaskId || null,
    },
    approvalContext: {
      createdBy: expense.createdBy,
      approvedBy: expense.approvedBy,
      approvedAt: expense.approvedAt,
      auditTrailCount: expense.auditTrail?.length || 0,
    },
  };
};

export const getFinanceDashboard = async (params = {}, user) => {
  if (user.role === ROLES.STUDENT) throw ApiError.forbidden('Access denied.');

  const filter = {};
  if (user.role === ROLES.WARDEN || user.role === ROLES.HOSTEL_STAFF) {
    filter.hostelId = user.hostelId;
  } else if (params.hostelId) {
    filter.hostelId = new mongoose.Types.ObjectId(params.hostelId);
  }

  if (params.financialYear) {
    filter.financialYear = params.financialYear.trim().toUpperCase();
  }

  // 1. Budgets aggregation
  const budgets = await HostelBudget.find(filter).lean();
  let totalAllocated = 0;
  let totalUtilized = 0;
  let totalRemaining = 0;

  budgets.forEach((b) => {
    const effective = b.revisedAmount != null ? b.revisedAmount : b.allocatedAmount;
    totalAllocated += effective;
    totalUtilized += b.utilizedAmount || 0;
    totalRemaining += b.remainingAmount != null ? b.remainingAmount : (effective - (b.utilizedAmount || 0));
  });

  // 2. Expenses count by status
  const expenseCounts = await HostelExpense.aggregate([
    { $match: filter },
    { $group: { _id: '$status', count: { $sum: 1 }, totalAmount: { $sum: '$amount' } } },
  ]);

  const countsMap = {};
  expenseCounts.forEach((ec) => {
    countsMap[ec._id] = { count: ec.count, amount: ec.totalAmount };
  });

  // 3. Category spend breakdown (Approved expenses)
  const categorySpends = await HostelExpense.aggregate([
    { $match: { ...filter, status: EXPENSE_STATUSES.APPROVED } },
    { $group: { _id: '$category', totalSpent: { $sum: '$amount' }, count: { $sum: 1 } } },
    { $sort: { totalSpent: -1 } },
  ]);

  // 4. Recent pending review expenses
  const pendingApprovals = await HostelExpense.find({
    ...filter,
    status: { $in: [EXPENSE_STATUSES.SUBMITTED, EXPENSE_STATUSES.UNDER_REVIEW] },
  })
    .populate('createdBy', 'name email')
    .populate('hostelId', 'name')
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();

  return {
    financialYear: params.financialYear || 'ALL',
    kpi: {
      totalBudget: totalAllocated,
      totalUtilized,
      totalRemaining,
      utilizationPercent: totalAllocated > 0 ? Math.round((totalUtilized / totalAllocated) * 100) : 0,
      draftCount: countsMap[EXPENSE_STATUSES.DRAFT]?.count || 0,
      pendingApprovalCount:
        (countsMap[EXPENSE_STATUSES.SUBMITTED]?.count || 0) +
        (countsMap[EXPENSE_STATUSES.UNDER_REVIEW]?.count || 0),
      approvedCount: countsMap[EXPENSE_STATUSES.APPROVED]?.count || 0,
      rejectedCount: countsMap[EXPENSE_STATUSES.REJECTED]?.count || 0,
    },
    categorySpends: categorySpends.map((cs) => ({
      category: cs._id,
      spent: cs.totalSpent,
      count: cs.count,
    })),
    pendingApprovals,
  };
};

// ============================================================================
// 6. CENTRAL SCHEDULER LIFECYCLE WORKER
// ============================================================================

export const processFinanceLifecycleJobs = async (now = new Date()) => {
  const summary = {
    budgetOverrunAlerts: 0,
    agingExpenseWarnings: 0,
  };

  try {
    // 1. Identify Over-budget records
    const overBudgets = await HostelBudget.find({
      $expr: {
        $gt: [
          '$utilizedAmount',
          { $ifNull: ['$revisedAmount', '$allocatedAmount'] },
        ],
      },
    }).populate('hostelId');

    summary.budgetOverrunAlerts = overBudgets.length;

    // 2. Identify Aging pending approvals (> 3 days in SUBMITTED state)
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const agingExpenses = await HostelExpense.find({
      status: EXPENSE_STATUSES.SUBMITTED,
      submittedAt: { $lte: threeDaysAgo },
    }).populate('hostelId');

    summary.agingExpenseWarnings = agingExpenses.length;
  } catch (err) {
    console.error('[financeService] Background cycle error:', err.message);
  }

  return summary;
};

export default {
  generateExpenseId,
  generateBudgetId,
  generateVendorId,
  getFinancialYears,
  createFinancialYear,
  closeFinancialYear,
  reopenFinancialYear,
  createBudget,
  getBudgets,
  updateBudget,
  getBudgetUtilization,
  createVendor,
  getVendors,
  getVendorById,
  updateVendor,
  deleteVendor,
  createExpense,
  getExpenses,
  getExpenseById,
  updateExpense,
  submitExpense,
  reviewExpense,
  approveExpense,
  rejectExpense,
  cancelExpense,
  getOperationalTraceability,
  getFinanceDashboard,
  processFinanceLifecycleJobs,
};
