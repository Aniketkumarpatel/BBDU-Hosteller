import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { ROLES } from '../constants/roles.js';
import {
  handleGetFinancialYears,
  handleCreateFinancialYear,
  handleCloseFinancialYear,
  handleReopenFinancialYear,
  handleCreateBudget,
  handleGetBudgets,
  handleUpdateBudget,
  handleGetBudgetUtilization,
  handleCreateVendor,
  handleGetVendors,
  handleGetVendorById,
  handleUpdateVendor,
  handleDeleteVendor,
  handleCreateExpense,
  handleGetExpenses,
  handleGetExpenseById,
  handleUpdateExpense,
  handleSubmitExpense,
  handleReviewExpense,
  handleApproveExpense,
  handleRejectExpense,
  handleCancelExpense,
  handleGetOperationalTraceability,
  handleGetFinanceDashboard,
} from '../controllers/finance.controller.js';

const router = Router();

// Authentication required on all finance routes
router.use(requireAuth);

// ============================================================================
// 1. FINANCIAL YEAR ROUTES
// ============================================================================
router.get(
  '/financial-years',
  requireRole(ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN),
  handleGetFinancialYears
);

router.post(
  '/financial-years',
  requireRole(ROLES.SUPER_ADMIN, ROLES.AUTHORITY),
  handleCreateFinancialYear
);

router.patch(
  '/financial-years/:id/close',
  requireRole(ROLES.SUPER_ADMIN, ROLES.AUTHORITY),
  handleCloseFinancialYear
);

router.patch(
  '/financial-years/:id/reopen',
  requireRole(ROLES.SUPER_ADMIN),
  handleReopenFinancialYear
);

// ============================================================================
// 2. BUDGET ROUTES
// ============================================================================
router.get(
  '/budgets/utilization',
  requireRole(ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN, ROLES.HOSTEL_STAFF),
  handleGetBudgetUtilization
);

router.get(
  '/budgets',
  requireRole(ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN, ROLES.HOSTEL_STAFF),
  handleGetBudgets
);

router.post(
  '/budgets',
  requireRole(ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN),
  handleCreateBudget
);

router.patch(
  '/budgets/:id',
  requireRole(ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN),
  handleUpdateBudget
);

// ============================================================================
// 3. VENDOR ROUTES
// ============================================================================
router.get(
  '/vendors',
  requireRole(ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN, ROLES.HOSTEL_STAFF),
  handleGetVendors
);

router.post(
  '/vendors',
  requireRole(ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN),
  handleCreateVendor
);

router.get(
  '/vendors/:id',
  requireRole(ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN, ROLES.HOSTEL_STAFF),
  handleGetVendorById
);

router.patch(
  '/vendors/:id',
  requireRole(ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN),
  handleUpdateVendor
);

router.delete(
  '/vendors/:id',
  requireRole(ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN),
  handleDeleteVendor
);

// ============================================================================
// 4. DASHBOARD & TRACEABILITY (Must precede /expenses/:id)
// ============================================================================
router.get(
  '/dashboard',
  requireRole(ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN, ROLES.HOSTEL_STAFF),
  handleGetFinanceDashboard
);

router.get(
  '/traceability/:id',
  requireRole(ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN, ROLES.HOSTEL_STAFF),
  handleGetOperationalTraceability
);

// ============================================================================
// 5. EXPENSE MANAGEMENT ROUTES
// ============================================================================
router.get(
  '/expenses',
  requireRole(ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN, ROLES.HOSTEL_STAFF),
  handleGetExpenses
);

router.post(
  '/expenses',
  requireRole(ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN, ROLES.HOSTEL_STAFF),
  handleCreateExpense
);

router.get(
  '/expenses/:id',
  requireRole(ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN, ROLES.HOSTEL_STAFF),
  handleGetExpenseById
);

router.patch(
  '/expenses/:id',
  requireRole(ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN, ROLES.HOSTEL_STAFF),
  handleUpdateExpense
);

router.post(
  '/expenses/:id/submit',
  requireRole(ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN, ROLES.HOSTEL_STAFF),
  handleSubmitExpense
);

router.post(
  '/expenses/:id/review',
  requireRole(ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN),
  handleReviewExpense
);

router.post(
  '/expenses/:id/approve',
  requireRole(ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN),
  handleApproveExpense
);

router.post(
  '/expenses/:id/reject',
  requireRole(ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN),
  handleRejectExpense
);

router.post(
  '/expenses/:id/cancel',
  requireRole(ROLES.SUPER_ADMIN, ROLES.AUTHORITY, ROLES.WARDEN, ROLES.HOSTEL_STAFF),
  handleCancelExpense
);

export default router;
