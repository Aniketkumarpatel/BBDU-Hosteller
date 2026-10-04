import asyncHandler from '../utils/asyncHandler.js';
import * as financeService from '../services/finance.service.js';

// Financial Year Controllers
export const handleGetFinancialYears = asyncHandler(async (_req, res) => {
  const data = await financeService.getFinancialYears();
  res.status(200).json({ success: true, data });
});

export const handleCreateFinancialYear = asyncHandler(async (req, res) => {
  const data = await financeService.createFinancialYear(req.body, req.user);
  res.status(201).json({ success: true, message: 'Financial Year created successfully.', data });
});

export const handleCloseFinancialYear = asyncHandler(async (req, res) => {
  const data = await financeService.closeFinancialYear(req.params.id, req.user);
  res.status(200).json({ success: true, message: 'Financial Year closed.', data });
});

export const handleReopenFinancialYear = asyncHandler(async (req, res) => {
  const data = await financeService.reopenFinancialYear(req.params.id, req.user);
  res.status(200).json({ success: true, message: 'Financial Year reopened.', data });
});

// Budget Controllers
export const handleCreateBudget = asyncHandler(async (req, res) => {
  const data = await financeService.createBudget(req.body, req.user);
  res.status(201).json({ success: true, message: 'Budget allocated successfully.', data });
});

export const handleGetBudgets = asyncHandler(async (req, res) => {
  const data = await financeService.getBudgets(req.query, req.user);
  res.status(200).json({ success: true, data });
});

export const handleUpdateBudget = asyncHandler(async (req, res) => {
  const data = await financeService.updateBudget(req.params.id, req.body, req.user);
  res.status(200).json({ success: true, message: 'Budget revised successfully.', data });
});

export const handleGetBudgetUtilization = asyncHandler(async (req, res) => {
  const data = await financeService.getBudgetUtilization(req.query, req.user);
  res.status(200).json({ success: true, data });
});

// Vendor Controllers
export const handleCreateVendor = asyncHandler(async (req, res) => {
  const data = await financeService.createVendor(req.body, req.user);
  res.status(201).json({ success: true, message: 'Vendor registered successfully.', data });
});

export const handleGetVendors = asyncHandler(async (req, res) => {
  const data = await financeService.getVendors(req.query, req.user);
  res.status(200).json({ success: true, data });
});

export const handleGetVendorById = asyncHandler(async (req, res) => {
  const data = await financeService.getVendorById(req.params.id, req.user);
  res.status(200).json({ success: true, data });
});

export const handleUpdateVendor = asyncHandler(async (req, res) => {
  const data = await financeService.updateVendor(req.params.id, req.body, req.user);
  res.status(200).json({ success: true, message: 'Vendor updated successfully.', data });
});

export const handleDeleteVendor = asyncHandler(async (req, res) => {
  const result = await financeService.deleteVendor(req.params.id, req.user);
  res.status(200).json(result);
});

// Expense Controllers
export const handleCreateExpense = asyncHandler(async (req, res) => {
  const data = await financeService.createExpense(req.body, req.user);
  res.status(201).json({ success: true, message: 'Expense created successfully.', data });
});

export const handleGetExpenses = asyncHandler(async (req, res) => {
  const result = await financeService.getExpenses(req.query, req.user);
  res.status(200).json({ success: true, data: result.expenses, pagination: result.pagination });
});

export const handleGetExpenseById = asyncHandler(async (req, res) => {
  const data = await financeService.getExpenseById(req.params.id, req.user);
  res.status(200).json({ success: true, data });
});

export const handleUpdateExpense = asyncHandler(async (req, res) => {
  const data = await financeService.updateExpense(req.params.id, req.body, req.user);
  res.status(200).json({ success: true, message: 'Expense updated successfully.', data });
});

export const handleSubmitExpense = asyncHandler(async (req, res) => {
  const data = await financeService.submitExpense(req.params.id, req.user);
  res.status(200).json({ success: true, message: 'Expense submitted for review.', data });
});

export const handleReviewExpense = asyncHandler(async (req, res) => {
  const data = await financeService.reviewExpense(req.params.id, req.user);
  res.status(200).json({ success: true, message: 'Expense placed under review.', data });
});

export const handleApproveExpense = asyncHandler(async (req, res) => {
  const data = await financeService.approveExpense(req.params.id, req.user);
  res.status(200).json({ success: true, message: 'Expense approved and recorded against budget.', data });
});

export const handleRejectExpense = asyncHandler(async (req, res) => {
  const data = await financeService.rejectExpense(req.params.id, req.body, req.user);
  res.status(200).json({ success: true, message: 'Expense rejected.', data });
});

export const handleCancelExpense = asyncHandler(async (req, res) => {
  const data = await financeService.cancelExpense(req.params.id, req.body, req.user);
  res.status(200).json({ success: true, message: 'Expense cancelled.', data });
});

// Traceability & Dashboard
export const handleGetOperationalTraceability = asyncHandler(async (req, res) => {
  const data = await financeService.getOperationalTraceability(req.params.id, req.user);
  res.status(200).json({ success: true, data });
});

export const handleGetFinanceDashboard = asyncHandler(async (req, res) => {
  const data = await financeService.getFinanceDashboard(req.query, req.user);
  res.status(200).json({ success: true, data });
});
