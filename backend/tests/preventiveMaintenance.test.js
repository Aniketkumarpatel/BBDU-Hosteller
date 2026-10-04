import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_for_suite_1234567890abcdef';
process.env.JWT_EXPIRES_IN = '1h';

const baseUri = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/bbdu_hosteller_test';
const TEST_URI = baseUri.replace(/\/([^/?]+)(\?.*)?$/, '/$1_preventive$2');

const { connectDB, disconnectDB } = await import('../src/config/db.js');
const { default: app } = await import('../src/app.js');
const {
  User,
  Hostel,
  Block,
  Floor,
  Room,
  Department,
  Asset,
  MaintenanceWorkOrder,
  MaintenancePlan,
  MaintenanceCycle,
  Notification,
} = await import('../src/models/index.js');
const { hashPassword } = await import('../src/utils/password.js');
const { signToken } = await import('../src/utils/jwt.js');
const { calculateNextDueDate } = await import('../src/utils/dateUtils.js');
const {
  processPreventiveMaintenanceJobs,
  evaluateAssetHealth,
} = await import('../src/services/preventiveMaintenance.service.js');
const {
  acceptWorkOrder,
  startWorkOrder,
  completeWorkOrder,
} = await import('../src/services/workOrder.service.js');
const { processSlaAndEscalations } = await import('../src/services/sla.service.js');

let server;
let baseUrl;

let adminToken;
let wardenToken;
let staffToken;
let studentToken;

let testHostel;
let testBlock;
let testFloor;
let testRoom;
let testDept;

let adminUser;
let wardenUser;
let staffUser;
let studentUser;

let testAsset;

before(async () => {
  await connectDB(TEST_URI);
  await mongoose.connection.dropDatabase();
  await Promise.all([
    User,
    Hostel,
    Block,
    Floor,
    Room,
    Department,
    Asset,
    MaintenanceWorkOrder,
    MaintenancePlan,
    MaintenanceCycle,
    Notification,
  ].map((m) => m.init()));

  server = app.listen(0);
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}/api`;

  testHostel = await Hostel.create({
    name: 'Tagore Boys Hostel',
    code: 'TBH-PM',
    type: 'BOYS',
    totalCapacity: 100,
    currentOccupancy: 0,
  });

  testBlock = await Block.create({
    name: 'Block A',
    code: 'A',
    hostelId: testHostel._id,
  });

  testFloor = await Floor.create({
    floorNumber: 1,
    name: 'Floor 1',
    hostelId: testHostel._id,
    blockId: testBlock._id,
  });

  testRoom = await Room.create({
    roomNumber: '101',
    hostelId: testHostel._id,
    blockId: testBlock._id,
    floorId: testFloor._id,
    capacity: 2,
    roomType: 'DOUBLE',
    currentOccupancy: 0,
  });

  testDept = await Department.create({
    name: 'Electrical Maintenance',
    code: 'ELEC-PM',
    contactEmail: 'elec-pm@bbdu.ac.in',
  });

  const pwd = await hashPassword('Password@123');

  adminUser = await User.create({
    name: 'Super Admin PM',
    email: 'admin-pm@bbdu.ac.in',
    passwordHash: pwd,
    role: 'SUPER_ADMIN',
  });

  wardenUser = await User.create({
    name: 'Warden PM',
    email: 'warden-pm@bbdu.ac.in',
    passwordHash: pwd,
    role: 'WARDEN',
    hostelId: testHostel._id,
    employeeId: 'WRD-PM-001',
  });

  staffUser = await User.create({
    name: 'Technician PM',
    email: 'tech-pm@bbdu.ac.in',
    passwordHash: pwd,
    role: 'HOSTEL_STAFF',
    departmentId: testDept._id,
    employeeId: 'STF-PM-001',
  });

  studentUser = await User.create({
    name: 'Student PM',
    email: 'student-pm@bbdu.ac.in',
    passwordHash: pwd,
    role: 'STUDENT',
    hostelId: testHostel._id,
    roomId: testRoom._id,
    studentId: 'STU-PM-001',
  });

  adminToken = signToken({ userId: adminUser._id, role: adminUser.role });
  wardenToken = signToken({ userId: wardenUser._id, role: wardenUser.role });
  staffToken = signToken({ userId: staffUser._id, role: staffUser.role });
  studentToken = signToken({ userId: studentUser._id, role: studentUser.role });

  testAsset = await Asset.create({
    assetId: 'AST-2026-99901',
    name: 'Main RO Water Purifier',
    assetType: 'WATER_PURIFIER',
    category: 'MESS',
    hostelId: testHostel._id,
    roomId: testRoom._id,
    departmentId: testDept._id,
    status: 'ACTIVE',
    condition: 'GOOD',
  });
});

after(async () => {
  if (server) await new Promise((res) => server.close(res));
  await disconnectDB();
});

test('1. Date calculation utility handles standard frequencies and month boundaries safely', async () => {
  // Days
  const d1 = new Date('2026-05-10T10:00:00.000Z');
  const plus10Days = calculateNextDueDate(d1, 10, 'DAYS');
  assert.equal(plus10Days.toISOString().slice(0, 10), '2026-05-20');

  // Weeks
  const plus2Weeks = calculateNextDueDate(d1, 2, 'WEEKS');
  assert.equal(plus2Weeks.toISOString().slice(0, 10), '2026-05-24');

  // Month boundary: Jan 31 + 1 month in non-leap year (2026) -> Feb 28
  const jan31 = new Date('2026-01-31T12:00:00.000Z');
  const febDue = calculateNextDueDate(jan31, 1, 'MONTHS');
  assert.equal(febDue.getFullYear(), 2026);
  assert.equal(febDue.getMonth(), 1); // 0-indexed: 1 = February
  assert.equal(febDue.getDate(), 28);

  // Month boundary in leap year: Jan 31 2028 + 1 month -> Feb 29
  const jan31Leap = new Date('2028-01-31T12:00:00.000Z');
  const febLeapDue = calculateNextDueDate(jan31Leap, 1, 'MONTHS');
  assert.equal(febLeapDue.getFullYear(), 2028);
  assert.equal(febLeapDue.getMonth(), 1);
  assert.equal(febLeapDue.getDate(), 29);

  // Oct 31 + 1 month -> Nov 30
  const oct31 = new Date('2026-10-31T12:00:00.000Z');
  const novDue = calculateNextDueDate(oct31, 1, 'MONTHS');
  assert.equal(novDue.getMonth(), 10); // November
  assert.equal(novDue.getDate(), 30);
});

test('2. RBAC Guards on Maintenance Plan endpoints', async () => {
  // Student cannot create maintenance plan (Forbidden 403)
  const resStudent = await fetch(`${baseUrl}/maintenance-plans`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${studentToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'Student Unauthorized Plan',
      assetId: testAsset._id,
      frequency: 3,
      frequencyUnit: 'MONTHS',
    }),
  });
  assert.equal(resStudent.status, 403);

  // Staff cannot create maintenance plan (Forbidden 403)
  const resStaff = await fetch(`${baseUrl}/maintenance-plans`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${staffToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'Staff Unauthorized Plan',
      assetId: testAsset._id,
      frequency: 1,
      frequencyUnit: 'MONTHS',
    }),
  });
  assert.equal(resStaff.status, 403);
});

let createdPlanId;
let planMongoId;

test('3. Warden creates a valid Preventive Maintenance Plan with cycle generation', async () => {
  const payload = {
    name: 'Quarterly RO Filter Replacement',
    description: 'Replace sediment and carbon filters and sanitize UV chamber',
    assetId: testAsset._id,
    maintenanceType: 'PREVENTIVE',
    frequency: 3,
    frequencyUnit: 'MONTHS',
    priority: 'HIGH',
    estimatedDuration: 3,
    preferredAssigneeId: staffUser._id,
  };

  const res = await fetch(`${baseUrl}/maintenance-plans`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${wardenToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const body = await res.json();
  assert.equal(res.status, 201);
  assert.equal(body.success, true);
  assert.ok(body.data.planId.startsWith('MP-'));
  assert.equal(body.data.name, payload.name);
  assert.equal(body.data.status, 'ACTIVE');
  assert.equal(body.data.isActive, true);
  assert.equal(body.data.currentCycleNumber, 1);
  assert.ok(body.data.nextDueAt);

  createdPlanId = body.data.planId;
  planMongoId = body.data._id;

  // Verify initial scheduled cycle was generated
  const cycle = await MaintenanceCycle.findOne({ planId: planMongoId, cycleNumber: 1 });
  assert.ok(cycle);
  assert.equal(cycle.status, 'SCHEDULED');
  assert.equal(cycle.isOverdue, false);
});

test('4. Plan update, pause, resume, and deactivation lifecycle', async () => {
  // Update name and frequency
  const patchRes = await fetch(`${baseUrl}/maintenance-plans/${planMongoId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${wardenToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'Updated Quarterly RO Filter Replacement',
      frequency: 2,
    }),
  });
  const patchBody = await patchRes.json();
  assert.equal(patchRes.status, 200);
  assert.equal(patchBody.data.name, 'Updated Quarterly RO Filter Replacement');
  assert.equal(patchBody.data.frequency, 2);

  // Pause
  const pauseRes = await fetch(`${baseUrl}/maintenance-plans/${planMongoId}/pause`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${wardenToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ reason: 'Hostel closed for summer vacations' }),
  });
  const pauseBody = await pauseRes.json();
  assert.equal(pauseRes.status, 200);
  assert.equal(pauseBody.data.status, 'PAUSED');
  assert.equal(pauseBody.data.isActive, false);

  // Resume
  const resumeRes = await fetch(`${baseUrl}/maintenance-plans/${planMongoId}/resume`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${wardenToken}`,
      'Content-Type': 'application/json',
    },
  });
  const resumeBody = await resumeRes.json();
  assert.equal(resumeRes.status, 200);
  assert.equal(resumeBody.data.status, 'ACTIVE');
  assert.equal(resumeBody.data.isActive, true);
});

test('5. Central Scheduler automatically generates Work Order when maintenance is due and prevents duplicates', async () => {
  // Set nextDueAt into the past to simulate due maintenance
  const pastDate = new Date(Date.now() - 2 * 3600 * 1000);
  await MaintenancePlan.findByIdAndUpdate(planMongoId, { nextDueAt: pastDate });

  // Run central scheduler cycle
  const schedulerResults = await processSlaAndEscalations();
  assert.ok(schedulerResults.preventiveMaintenance);
  assert.equal(schedulerResults.preventiveMaintenance.workOrdersGenerated, 1);

  // Verify Work Order was generated
  const plan = await MaintenancePlan.findById(planMongoId);
  assert.ok(plan.lastWorkOrderId);

  const workOrder = await MaintenanceWorkOrder.findById(plan.lastWorkOrderId);
  assert.ok(workOrder);
  assert.ok(workOrder.workOrderId.startsWith('WO-'));
  assert.equal(String(workOrder.assetId), String(testAsset._id));
  assert.equal(String(workOrder.maintenancePlanId), String(plan._id));
  assert.equal(workOrder.status, 'ASSIGNED'); // Preferred assignee was set
  assert.equal(String(workOrder.assignedTo), String(staffUser._id));

  // Verify cycle was updated
  const cycle = await MaintenanceCycle.findOne({ planId: planMongoId, cycleNumber: 1 });
  assert.equal(cycle.status, 'WORK_ORDER_CREATED');
  assert.equal(String(cycle.workOrderId), String(workOrder._id));

  // Idempotency: Run scheduler cycle AGAIN immediately. No duplicate work orders should be created!
  const secondRunResults = await processSlaAndEscalations();
  assert.equal(secondRunResults.preventiveMaintenance.workOrdersGenerated, 0);

  const totalWOsForPlan = await MaintenanceWorkOrder.countDocuments({ maintenancePlanId: planMongoId });
  assert.equal(totalWOsForPlan, 1, 'Idempotency guarantee: exactly 1 work order must exist');
});

test('6. Completing generated maintenance work order advances cycle, calculates next due date, and updates asset history', async () => {
  const planBefore = await MaintenancePlan.findById(planMongoId);
  const workOrder = await MaintenanceWorkOrder.findById(planBefore.lastWorkOrderId);

  // Accept & Start work order via workOrder.service
  await acceptWorkOrder(workOrder._id, staffUser);
  await startWorkOrder(workOrder._id, staffUser);

  // Complete work order via workOrder.service
  await completeWorkOrder(
    workOrder._id,
    { completionNote: 'Replaced carbon cartridges and calibrated membrane pressure' },
    staffUser
  );

  // Verify work order is completed
  const updatedWO = await MaintenanceWorkOrder.findById(workOrder._id);
  assert.equal(updatedWO.status, 'COMPLETED');

  // Verify plan advanced to cycle 2 and calculated nextDueAt
  const planAfter = await MaintenancePlan.findById(planMongoId);
  assert.equal(planAfter.currentCycleNumber, 2);
  assert.ok(planAfter.lastCompletedAt);
  assert.ok(planAfter.nextDueAt > new Date());

  // Verify cycle 1 marked COMPLETED
  const cycle1 = await MaintenanceCycle.findOne({ planId: planMongoId, cycleNumber: 1 });
  assert.equal(cycle1.status, 'COMPLETED');
  assert.ok(cycle1.completedAt);
  assert.equal(cycle1.completionNotes, 'Replaced carbon cartridges and calibrated membrane pressure');

  // Verify cycle 2 was provisioned as SCHEDULED
  const cycle2 = await MaintenanceCycle.findOne({ planId: planMongoId, cycleNumber: 2 });
  assert.ok(cycle2);
  assert.equal(cycle2.status, 'SCHEDULED');
  assert.equal(cycle2.dueDate.toISOString(), planAfter.nextDueAt.toISOString());

  // Verify asset completedMaintenanceCount incremented
  const updatedAsset = await Asset.findById(testAsset._id);
  assert.equal(updatedAsset.completedMaintenanceCount, 1);
  assert.ok(updatedAsset.lastMaintenanceDate);
});

test('7. Asset Health Indicators, Maintenance History, and Dashboard Queues', async () => {
  // Test evaluateAssetHealth deterministic logic
  const healthyAsset = evaluateAssetHealth(testAsset, [], []);
  assert.equal(healthyAsset, 'HEALTHY');

  // Critical asset status
  const criticalAsset = evaluateAssetHealth({ status: 'DAMAGED', condition: 'CRITICAL' }, [], []);
  assert.equal(criticalAsset, 'CRITICAL');

  // Overdue asset
  const overdueAsset = evaluateAssetHealth(
    testAsset,
    [],
    [{ status: 'ACTIVE', nextDueAt: new Date(Date.now() - 10000) }]
  );
  assert.equal(overdueAsset, 'OVERDUE');

  // Frequently failing asset (>= 3 work orders in 90 days)
  const mockWorkOrders = [
    { createdAt: new Date() },
    { createdAt: new Date() },
    { createdAt: new Date() },
  ];
  const freqFailingAsset = evaluateAssetHealth(testAsset, mockWorkOrders, []);
  assert.equal(freqFailingAsset, 'FREQUENTLY_FAILING');

  // Test Asset Maintenance History endpoint returns plans and health
  const historyRes = await fetch(`${baseUrl}/assets/${testAsset._id}/maintenance-history`, {
    headers: { Authorization: `Bearer ${wardenToken}` },
  });
  const historyBody = await historyRes.json();
  assert.equal(historyRes.status, 200);
  assert.ok(historyBody.data.maintenancePlans);
  assert.equal(historyBody.data.maintenancePlans.length, 1);
  assert.ok(historyBody.data.cycles);
  assert.ok(historyBody.data.assetHealth);

  // Test Preventive Maintenance Dashboard endpoint
  const dashRes = await fetch(`${baseUrl}/maintenance/dashboard`, {
    headers: { Authorization: `Bearer ${wardenToken}` },
  });
  const dashBody = await dashRes.json();
  assert.equal(dashRes.status, 200);
  assert.equal(dashBody.success, true);
  assert.ok(dashBody.data.totalActivePlans >= 1);
  assert.equal(dashBody.data.completedThisMonth, 1);
});
