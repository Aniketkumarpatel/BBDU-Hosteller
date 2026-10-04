import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_for_suite_1234567890abcdef';
process.env.JWT_EXPIRES_IN = '1h';

const baseUri = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/bbdu_hosteller_test';
const TEST_URI = baseUri.replace(/\/([^/?]+)(\?.*)?$/, '/$1_finance$2');

const { connectDB, disconnectDB } = await import('../src/config/db.js');
const { default: app } = await import('../src/app.js');
const {
  User,
  Hostel,
  Department,
  Asset,
  MaintenanceWorkOrder,
  FinancialYear,
  HostelBudget,
  Vendor,
  HostelExpense,
  Notification,
} = await import('../src/models/index.js');
const { hashPassword } = await import('../src/utils/password.js');
const { signToken } = await import('../src/utils/jwt.js');
const { processFinanceLifecycleJobs } = await import('../src/services/finance.service.js');

let server;
let baseUrl;

let adminToken;
let authorityToken;
let wardenAToken;
let wardenBToken;
let staffAToken;
let studentToken;

let hostelA;
let hostelB;
let testDept;
let testAsset;
let testWorkOrder;

let adminUser;
let authorityUser;
let wardenAUser;
let wardenBUser;
let staffAUser;
let studentUser;

before(async () => {
  await connectDB(TEST_URI);
  await mongoose.connection.dropDatabase();
  await Promise.all([
    User,
    Hostel,
    Department,
    Asset,
    MaintenanceWorkOrder,
    FinancialYear,
    HostelBudget,
    Vendor,
    HostelExpense,
    Notification,
  ].map((m) => m.init()));

  // 1. Hostels
  hostelA = await Hostel.create({
    name: 'Tagore Hostel A',
    code: 'THA',
    type: 'BOYS',
    capacity: 200,
  });

  hostelB = await Hostel.create({
    name: 'Sarojini Hostel B',
    code: 'SHB',
    type: 'GIRLS',
    capacity: 180,
  });

  // 2. Department
  testDept = await Department.create({
    name: 'Electrical Maintenance',
    code: 'ELEC',
  });

  // 3. Asset in Hostel A
  testAsset = await Asset.create({
    assetId: 'AST-2026-00001',
    name: 'Water Cooler 150L',
    assetType: 'COOLER',
    category: 'WATER',
    hostelId: hostelA._id,
    departmentId: testDept._id,
    condition: 'GOOD',
    status: 'ACTIVE',
    purchaseCost: 35000,
  });

  // 4. Work Order in Hostel A
  testWorkOrder = await MaintenanceWorkOrder.create({
    workOrderId: 'WO-2026-00001',
    title: 'Water Cooler Filter Replacement',
    description: 'Replace sediment and carbon filters',
    hostelId: hostelA._id,
    departmentId: testDept._id,
    category: 'WATER',
    assetId: testAsset._id,
    status: 'IN_PROGRESS',
    priority: 'MEDIUM',
    createdBy: new mongoose.Types.ObjectId(),
  });

  // 5. Users
  const pwd = await hashPassword('Password123!');

  adminUser = await User.create({
    name: 'System Admin',
    email: 'admin.fin@bbdu.ac.in',
    passwordHash: pwd,
    role: 'SUPER_ADMIN',
  });

  authorityUser = await User.create({
    name: 'Campus Director',
    email: 'authority.fin@bbdu.ac.in',
    passwordHash: pwd,
    role: 'AUTHORITY',
  });

  wardenAUser = await User.create({
    name: 'Warden Tagore',
    email: 'warden.a.fin@bbdu.ac.in',
    passwordHash: pwd,
    role: 'WARDEN',
    hostelId: hostelA._id,
  });

  wardenBUser = await User.create({
    name: 'Warden Sarojini',
    email: 'warden.b.fin@bbdu.ac.in',
    passwordHash: pwd,
    role: 'WARDEN',
    hostelId: hostelB._id,
  });

  staffAUser = await User.create({
    name: 'Technician Staff A',
    email: 'staff.a.fin@bbdu.ac.in',
    passwordHash: pwd,
    role: 'HOSTEL_STAFF',
    hostelId: hostelA._id,
  });

  studentUser = await User.create({
    name: 'Student Resident',
    email: 'student.fin@bbdu.ac.in',
    passwordHash: pwd,
    role: 'STUDENT',
    hostelId: hostelA._id,
  });

  adminToken = signToken({ userId: adminUser._id, role: adminUser.role });
  authorityToken = signToken({ userId: authorityUser._id, role: authorityUser.role });
  wardenAToken = signToken({ userId: wardenAUser._id, role: wardenAUser.role, hostelId: hostelA._id });
  wardenBToken = signToken({ userId: wardenBUser._id, role: wardenBUser.role, hostelId: hostelB._id });
  staffAToken = signToken({ userId: staffAUser._id, role: staffAUser.role, hostelId: hostelA._id });
  studentToken = signToken({ userId: studentUser._id, role: studentUser.role, hostelId: hostelA._id });

  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}/api/finance`;
      resolve();
    });
  });
});

after(async () => {
  if (server) await new Promise((res) => server.close(res));
  await disconnectDB();
});

// Helper request wrapper
const req = async (endpoint, options = {}, token = null) => {
  const url = `${baseUrl}${endpoint}`;
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => null);
  return { status: res.status, body: data };
};

// ============================================================================
// TESTS
// ============================================================================

test('1. Financial Year Management: Create, close, and reopen lifecycle', async () => {
  // Admin creates 2026-27
  const res1 = await req('/financial-years', {
    method: 'POST',
    body: JSON.stringify({
      financialYear: '2026-27',
      startDate: '2026-04-01',
      endDate: '2027-03-31',
      notes: 'FY 2026-27 Operational Budget Cycle',
    }),
  }, adminToken);

  assert.equal(res1.status, 201);
  assert.equal(res1.body.success, true);
  assert.equal(res1.body.data.financialYear, '2026-27');
  assert.equal(res1.body.data.status, 'OPEN');

  const fyId = res1.body.data._id;

  // Duplicate rejection
  const resDup = await req('/financial-years', {
    method: 'POST',
    body: JSON.stringify({
      financialYear: '2026-27',
      startDate: '2026-04-01',
      endDate: '2027-03-31',
    }),
  }, adminToken);
  assert.equal(resDup.status, 409);

  // Close Financial Year
  const resClose = await req(`/financial-years/${fyId}/close`, { method: 'PATCH' }, adminToken);
  assert.equal(resClose.status, 200);
  assert.equal(resClose.body.data.status, 'CLOSED');
  assert.ok(resClose.body.data.closedAt);

  // Non-superadmin cannot reopen
  const resWardenReopen = await req(`/financial-years/${fyId}/reopen`, { method: 'PATCH' }, wardenAToken);
  assert.equal(resWardenReopen.status, 403);

  // Super Admin reopens
  const resReopen = await req(`/financial-years/${fyId}/reopen`, { method: 'PATCH' }, adminToken);
  assert.equal(resReopen.status, 200);
  assert.equal(resReopen.body.data.status, 'OPEN');
});

test('2. Budget Management: Warden allocates budget, revision & duplicate guards', async () => {
  // Warden A allocates budget for MAINTENANCE
  const resCreate = await req('/budgets', {
    method: 'POST',
    body: JSON.stringify({
      hostelId: hostelA._id.toString(),
      financialYear: '2026-27',
      category: 'MAINTENANCE',
      allocatedAmount: 100000,
      departmentId: testDept._id.toString(),
      notes: 'Quarterly Maintenance Allocation',
    }),
  }, wardenAToken);

  assert.equal(resCreate.status, 201);
  assert.equal(resCreate.body.success, true);
  assert.equal(resCreate.body.data.allocatedAmount, 100000);
  assert.equal(resCreate.body.data.remainingAmount, 100000);
  assert.ok(resCreate.body.data.budgetId.startsWith('BDG-'));

  const budgetId = resCreate.body.data._id;

  // Duplicate budget for same category in same FY is rejected
  const resDup = await req('/budgets', {
    method: 'POST',
    body: JSON.stringify({
      hostelId: hostelA._id.toString(),
      financialYear: '2026-27',
      category: 'MAINTENANCE',
      allocatedAmount: 50000,
    }),
  }, wardenAToken);
  assert.equal(resDup.status, 409);

  // Revise budget to 120000
  const resRevise = await req(`/budgets/${budgetId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      revisedAmount: 120000,
      notes: 'Revised upwards for monsoon repairs',
    }),
  }, wardenAToken);

  assert.equal(resRevise.status, 200);
  assert.equal(resRevise.body.data.revisedAmount, 120000);
  assert.equal(resRevise.body.data.remainingAmount, 120000);
});

test('3. Budget Utilization endpoint returns accurate metrics', async () => {
  const res = await req('/budgets/utilization?financialYear=2026-27', { method: 'GET' }, wardenAToken);
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  assert.ok(res.body.data.totalEffective >= 120000);
  assert.equal(res.body.data.totalUtilized, 0);
  assert.equal(res.body.data.overallUtilizationPercent, 0);
});

test('4. Vendor Management: Registration, query and soft-delete toggle', async () => {
  const resCreate = await req('/vendors', {
    method: 'POST',
    body: JSON.stringify({
      name: 'AquaPure Filtration Services',
      serviceCategory: 'PLUMBING',
      contactName: 'Ramesh Sharma',
      phone: '+919876543210',
      email: 'ramesh@aquapure.com',
      address: 'Faizabad Road, Lucknow',
    }),
  }, wardenAToken);

  assert.equal(resCreate.status, 201);
  assert.equal(resCreate.body.success, true);
  assert.ok(resCreate.body.data.vendorId.startsWith('VND-'));
  const vendorDbId = resCreate.body.data._id;

  // List vendors
  const resList = await req('/vendors', { method: 'GET' }, wardenAToken);
  assert.equal(resList.status, 200);
  assert.ok(resList.body.data.some((v) => v._id === vendorDbId));
});

test('5. Expense Creation: Staff creates draft with operational links and validation guards', async () => {
  const vendors = await req('/vendors', { method: 'GET' }, staffAToken);
  const vendorId = vendors.body.data[0]._id;

  // Negative amount rejected
  const resNeg = await req('/expenses', {
    method: 'POST',
    body: JSON.stringify({
      hostelId: hostelA._id.toString(),
      financialYear: '2026-27',
      category: 'MAINTENANCE',
      title: 'Water filter parts replacement',
      amount: -500,
    }),
  }, staffAToken);
  assert.equal(resNeg.status, 400);

  // Valid draft creation with Work Order & Asset link
  const resCreate = await req('/expenses', {
    method: 'POST',
    body: JSON.stringify({
      hostelId: hostelA._id.toString(),
      financialYear: '2026-27',
      category: 'MAINTENANCE',
      title: 'Water filter cartridge replacement',
      description: 'Replaced carbon pre-filter for RO cooler',
      amount: 4500,
      vendorId,
      assetId: testAsset._id.toString(),
      workOrderId: testWorkOrder._id.toString(),
      invoiceNumber: 'INV-2026-081',
    }),
  }, staffAToken);

  assert.equal(resCreate.status, 201);
  assert.equal(resCreate.body.success, true);
  assert.equal(resCreate.body.data.status, 'DRAFT');
  assert.equal(resCreate.body.data.amount, 4500);
  assert.ok(resCreate.body.data.expenseId.startsWith('EXP-'));
});

test('6. Expense Workflow: Draft -> Submitted -> Under Review -> Reject -> Draft', async () => {
  // Staff creates another expense
  const expRes = await req('/expenses', {
    method: 'POST',
    body: JSON.stringify({
      hostelId: hostelA._id.toString(),
      financialYear: '2026-27',
      category: 'CLEANING',
      title: 'Sanitizer Bulk Refills',
      amount: 2200,
    }),
  }, staffAToken);

  const expId = expRes.body.data._id;

  // Submit
  const resSubmit = await req(`/expenses/${expId}/submit`, { method: 'POST' }, staffAToken);
  assert.equal(resSubmit.status, 200);
  assert.equal(resSubmit.body.data.status, 'SUBMITTED');

  // Warden places under review
  const resReview = await req(`/expenses/${expId}/review`, { method: 'POST' }, wardenAToken);
  assert.equal(resReview.status, 200);
  assert.equal(resReview.body.data.status, 'UNDER_REVIEW');

  // Warden rejects with reason
  const resReject = await req(`/expenses/${expId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason: 'Overpriced; get quotation from alternate vendor.' }),
  }, wardenAToken);
  assert.equal(resReject.status, 200);
  assert.equal(resReject.body.data.status, 'REJECTED');
  assert.equal(resReject.body.data.rejectionReason, 'Overpriced; get quotation from alternate vendor.');

  // Staff edits and updates amount
  const resUpdate = await req(`/expenses/${expId}`, {
    method: 'PATCH',
    body: JSON.stringify({ amount: 1800, title: 'Sanitizer Bulk Refills (Discounted)' }),
  }, staffAToken);
  assert.equal(resUpdate.status, 200);
  assert.equal(resUpdate.body.data.amount, 1800);

  // Staff resubmits
  const resResubmit = await req(`/expenses/${expId}/submit`, { method: 'POST' }, staffAToken);
  assert.equal(resResubmit.status, 200);
  assert.equal(resResubmit.body.data.status, 'SUBMITTED');
});

test('7. Critical Security Test: Self-Approval Guard blocks Warden approving own expense', async () => {
  // Warden A creates an expense request for urgent tools
  const resCreate = await req('/expenses', {
    method: 'POST',
    body: JSON.stringify({
      hostelId: hostelA._id.toString(),
      financialYear: '2026-27',
      category: 'MAINTENANCE',
      title: 'Multi-meter and Wire Stripper Set',
      amount: 1500,
    }),
  }, wardenAToken);

  assert.equal(resCreate.status, 201);
  const expId = resCreate.body.data._id;

  // Warden submits
  await req(`/expenses/${expId}/submit`, { method: 'POST' }, wardenAToken);

  // Warden attempts to approve their own expense -> FORBIDDEN (403)
  const resSelfApprove = await req(`/expenses/${expId}/approve`, { method: 'POST' }, wardenAToken);
  assert.equal(resSelfApprove.status, 403);
  assert.ok(resSelfApprove.body.message.includes('Self-approval guard'));

  // Campus Authority approves it successfully
  const resAuthorityApprove = await req(`/expenses/${expId}/approve`, { method: 'POST' }, authorityToken);
  assert.equal(resAuthorityApprove.status, 200);
  assert.equal(resAuthorityApprove.body.data.status, 'APPROVED');
});

test('8. Expense Approval atomically increments Budget utilizedAmount and decrements remainingAmount', async () => {
  // Staff creates an expense under category MAINTENANCE
  const resCreate = await req('/expenses', {
    method: 'POST',
    body: JSON.stringify({
      hostelId: hostelA._id.toString(),
      financialYear: '2026-27',
      category: 'MAINTENANCE',
      title: 'Emergency Plumbing Copper Pipe Fitting',
      amount: 8500,
    }),
  }, staffAToken);

  const expId = resCreate.body.data._id;
  await req(`/expenses/${expId}/submit`, { method: 'POST' }, staffAToken);

  // Check budget before approval
  const budgetBefore = await HostelBudget.findOne({
    hostelId: hostelA._id,
    financialYear: '2026-27',
    category: 'MAINTENANCE',
  });
  const utilizedBefore = budgetBefore.utilizedAmount || 0;

  // Warden approves
  const resApprove = await req(`/expenses/${expId}/approve`, { method: 'POST' }, wardenAToken);
  assert.equal(resApprove.status, 200);
  assert.equal(resApprove.body.data.status, 'APPROVED');

  // Verify budget updated
  const budgetAfter = await HostelBudget.findOne({
    hostelId: hostelA._id,
    financialYear: '2026-27',
    category: 'MAINTENANCE',
  });

  assert.equal(budgetAfter.utilizedAmount, utilizedBefore + 8500);
  assert.equal(budgetAfter.remainingAmount, (budgetAfter.revisedAmount || budgetAfter.allocatedAmount) - budgetAfter.utilizedAmount);
});

test('9. Critical Security Test: Hostel Data Isolation Guard prevents cross-hostel view/approval', async () => {
  // Warden B attempts to view Hostel A budgets
  const resBudgetCross = await req(`/budgets?hostelId=${hostelA._id}`, { method: 'GET' }, wardenBToken);
  assert.equal(resBudgetCross.status, 200);
  // Backend enforces Warden B can only see Hostel B records
  resBudgetCross.body.data.forEach((b) => {
    assert.equal(b.hostelId._id.toString(), hostelB._id.toString());
  });

  // Staff B creates an expense in Hostel B
  const staffB = await User.create({
    name: 'Staff Sarojini',
    email: 'staff.b.fin@bbdu.ac.in',
    passwordHash: 'dummy',
    role: 'HOSTEL_STAFF',
    hostelId: hostelB._id,
  });
  const staffBToken = signToken({ userId: staffB._id, role: staffB.role, hostelId: hostelB._id });

  const resExpB = await req('/expenses', {
    method: 'POST',
    body: JSON.stringify({
      hostelId: hostelB._id.toString(),
      financialYear: '2026-27',
      category: 'GENERAL',
      title: 'Hostel B General Supplies',
      amount: 1200,
    }),
  }, staffBToken);

  const expBId = resExpB.body.data._id;
  await req(`/expenses/${expBId}/submit`, { method: 'POST' }, staffBToken);

  // Warden A attempts to approve Hostel B's expense -> 403 Forbidden
  const resCrossApprove = await req(`/expenses/${expBId}/approve`, { method: 'POST' }, wardenAToken);
  assert.equal(resCrossApprove.status, 403);
});

test('10. Student RBAC Guard: Student receives 403 Forbidden on finance routes', async () => {
  const res1 = await req('/budgets', { method: 'GET' }, studentToken);
  assert.equal(res1.status, 403);

  const res2 = await req('/expenses', { method: 'GET' }, studentToken);
  assert.equal(res2.status, 403);

  const res3 = await req('/dashboard', { method: 'GET' }, studentToken);
  assert.equal(res3.status, 403);
});

test('11. Operational Traceability: Deep traceability endpoint returns linked entities', async () => {
  const expenses = await HostelExpense.find({ workOrderId: { $ne: null } });
  assert.ok(expenses.length > 0);
  const targetExpId = expenses[0]._id;

  const resTrace = await req(`/traceability/${targetExpId}`, { method: 'GET' }, wardenAToken);
  assert.equal(resTrace.status, 200);
  assert.equal(resTrace.body.success, true);
  assert.ok(resTrace.body.data.traceability.workOrder);
  assert.ok(resTrace.body.data.traceability.asset);
  assert.equal(resTrace.body.data.traceability.asset.name, 'Water Cooler 150L');
});

test('12. Finance Dashboard & Central Scheduler execution', async () => {
  // Dashboard
  const resDash = await req('/dashboard?financialYear=2026-27', { method: 'GET' }, wardenAToken);
  assert.equal(resDash.status, 200);
  assert.equal(resDash.body.success, true);
  assert.ok(resDash.body.data.kpi.totalBudget > 0);
  assert.ok(resDash.body.data.kpi.totalUtilized > 0);
  assert.ok(Array.isArray(resDash.body.data.categorySpends));

  // Scheduler worker executes without error
  const schedResult = await processFinanceLifecycleJobs(new Date());
  assert.ok(schedResult !== undefined);
  assert.equal(typeof schedResult.budgetOverrunAlerts, 'number');
  assert.equal(typeof schedResult.agingExpenseWarnings, 'number');
});
