import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_for_suite_1234567890abcdef';
process.env.JWT_EXPIRES_IN = '1h';

const baseUri = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/bbdu_hosteller_test';
const TEST_URI = baseUri.replace(/\/([^/?]+)(\?.*)?$/, '/$1_work_order$2');

const { connectDB, disconnectDB } = await import('../src/config/db.js');
const { default: app } = await import('../src/app.js');
const {
  User,
  Hostel,
  Block,
  Floor,
  Room,
  Department,
  Complaint,
  Asset,
  MaintenanceWorkOrder,
  Notification,
  SlaRule,
} = await import('../src/models/index.js');
const { hashPassword } = await import('../src/utils/password.js');
const { signToken } = await import('../src/utils/jwt.js');
const { processSlaAndEscalations } = await import('../src/services/sla.service.js');

let server;
let baseUrl;

let adminToken;
let wardenToken;
let staff1Token;
let staff2Token;
let studentToken;

let testHostel;
let testBlock;
let testFloor;
let testRoom;
let testDept;

let adminUser;
let wardenUser;
let staffUser1;
let staffUser2;
let studentUser;

let testComplaint;

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
    Complaint,
    Asset,
    MaintenanceWorkOrder,
    Notification,
    SlaRule,
  ].map((m) => m.syncIndexes()));

  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });

  const pw = await hashPassword('Password@123');

  testHostel = await Hostel.create({
    name: 'Tagore Hostel Maintenance',
    code: 'TAG-MAINT',
    type: 'BOYS',
    address: 'Campus Lucknow',
  });

  testBlock = await Block.create({
    name: 'Block A',
    code: 'A',
    hostelId: testHostel._id,
  });

  testFloor = await Floor.create({
    floorNumber: 1,
    name: '1st Floor',
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
  });

  testDept = await Department.create({
    name: 'Electrical Maintenance',
    code: 'ELEC-MAINT',
    type: 'MAINTENANCE',
  });

  // Users
  adminUser = await User.create({
    name: 'Super Admin',
    email: 'admin_wo@bbdu.ac.in',
    passwordHash: pw,
    role: 'SUPER_ADMIN',
  });
  adminToken = signToken({ userId: adminUser._id, role: adminUser.role });

  wardenUser = await User.create({
    name: 'Warden Tagore',
    email: 'warden_wo@bbdu.ac.in',
    passwordHash: pw,
    role: 'WARDEN',
    hostelId: testHostel._id,
  });
  wardenToken = signToken({ userId: wardenUser._id, role: wardenUser.role });

  staffUser1 = await User.create({
    name: 'Technician 1',
    email: 'tech1_wo@bbdu.ac.in',
    passwordHash: pw,
    role: 'HOSTEL_STAFF',
    departmentId: testDept._id,
    hostelId: testHostel._id,
  });
  staff1Token = signToken({ userId: staffUser1._id, role: staffUser1.role });

  staffUser2 = await User.create({
    name: 'Technician 2',
    email: 'tech2_wo@bbdu.ac.in',
    passwordHash: pw,
    role: 'HOSTEL_STAFF',
    departmentId: testDept._id,
    hostelId: testHostel._id,
  });
  staff2Token = signToken({ userId: staffUser2._id, role: staffUser2.role });

  studentUser = await User.create({
    name: 'Student Rahul',
    email: 'rahul_wo@bbdu.ac.in',
    passwordHash: pw,
    role: 'STUDENT',
    studentId: 'STU-WO-001',
    hostelId: testHostel._id,
    blockId: testBlock._id,
    floorId: testFloor._id,
    roomId: testRoom._id,
  });
  studentToken = signToken({ userId: studentUser._id, role: studentUser.role });

  // Seed a complaint for linkage
  testComplaint = await Complaint.create({
    complaintId: 'CMP-WO-001',
    title: 'Ceiling Fan Broken',
    description: 'Ceiling fan makes grinding noise and does not rotate.',
    category: 'ELECTRICAL',
    issueType: 'FAN_NOT_WORKING',
    priority: 'HIGH',
    status: 'ASSIGNED',
    studentId: studentUser._id,
    hostelId: testHostel._id,
    blockId: testBlock._id,
    floorId: testFloor._id,
    roomId: testRoom._id,
    departmentId: testDept._id,
    assignedTo: staffUser1._id,
    submittedAt: new Date(),
    assignedAt: new Date(),
  });
});

after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await disconnectDB();
});

test('1. Asset CRUD operations and authorization guards', async () => {
  // Student cannot create assets (403)
  const deniedRes = await fetch(`${baseUrl}/api/assets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify({
      name: 'Ceiling Fan - Crompton',
      category: 'ELECTRICAL',
      hostelId: testHostel._id,
      departmentId: testDept._id,
    }),
  });
  assert.equal(deniedRes.status, 403);

  // Admin creates asset
  const createRes = await fetch(`${baseUrl}/api/assets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      name: 'Ceiling Fan - Crompton 1200mm',
      assetType: 'FAN',
      category: 'ELECTRICAL',
      hostelId: testHostel._id,
      blockId: testBlock._id,
      floorId: testFloor._id,
      roomId: testRoom._id,
      departmentId: testDept._id,
      serialNumber: 'CRMP-9921',
      condition: 'GOOD',
    }),
  });
  assert.equal(createRes.status, 201);
  const createdBody = await createRes.json();
  assert.equal(createdBody.success, true);
  assert.match(createdBody.data.assetId, /^AST-\d{4}-\d{5}$/);
  const createdAssetId = createdBody.data._id;

  // List assets
  const listRes = await fetch(`${baseUrl}/api/assets?hostelId=${testHostel._id}`, {
    headers: { Authorization: `Bearer ${wardenToken}` },
  });
  assert.equal(listRes.status, 200);
  const listBody = await listRes.json();
  assert.equal(listBody.data.length, 1);
  assert.equal(listBody.data[0].serialNumber, 'CRMP-9921');

  // Update asset
  const updateRes = await fetch(`${baseUrl}/api/assets/${createdAssetId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ condition: 'FAIR', notes: 'Bearing slightly noisy' }),
  });
  assert.equal(updateRes.status, 200);
  const updateBody = await updateRes.json();
  assert.equal(updateBody.data.condition, 'FAIR');

  // Retire asset
  const retireRes = await fetch(`${baseUrl}/api/assets/${createdAssetId}/retire`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(retireRes.status, 200);
  const retireBody = await retireRes.json();
  assert.equal(retireBody.data.status, 'RETIRED');
});

test('2. Work order creation linked to Complaint and Asset', async () => {
  // Create an active asset for testing linkage
  const asset = await Asset.create({
    assetId: 'AST-2026-00099',
    name: 'Exhaust Fan',
    assetType: 'FAN',
    category: 'ELECTRICAL',
    hostelId: testHostel._id,
    departmentId: testDept._id,
    status: 'ACTIVE',
    condition: 'GOOD',
  });

  // Student cannot create work order (403)
  const studentRes = await fetch(`${baseUrl}/api/work-orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify({
      complaintId: testComplaint._id,
      title: 'Fix Exhaust Fan',
      description: 'Fan needs urgent replacement',
      hostelId: testHostel._id,
      departmentId: testDept._id,
    }),
  });
  assert.equal(studentRes.status, 403);

  // Warden creates work order linked to complaint and asset
  const createRes = await fetch(`${baseUrl}/api/work-orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${wardenToken}`,
    },
    body: JSON.stringify({
      complaintId: testComplaint._id,
      assetId: asset._id,
      title: 'Replace Exhaust Fan Capacitor',
      description: 'Capacitor failed; replace with 2.5uF part.',
      priority: 'HIGH',
      hostelId: testHostel._id,
      departmentId: testDept._id,
      assignedTo: staffUser1._id,
    }),
  });
  assert.equal(createRes.status, 201);
  const body = await createRes.json();
  assert.equal(body.success, true);
  assert.match(body.data.workOrderId, /^WO-\d{4}-\d{5}$/);
  assert.equal(body.data.status, 'ASSIGNED');
  assert.equal(body.data.slaStatus, 'ACTIVE');
  assert.ok(body.data.dueAt);
  assert.equal(body.data.auditLog.length, 1);
  assert.equal(body.data.auditLog[0].action, 'CREATED');

  // Verify Asset totalWorkOrders incremented
  const updatedAsset = await Asset.findById(asset._id);
  assert.equal(updatedAsset.totalWorkOrders, 1);

  // Verify staff received notification
  const notif = await Notification.findOne({
    recipient: staffUser1._id,
    relatedEntityId: body.data._id,
  });
  assert.ok(notif);
  assert.equal(notif.type, 'WORK_ORDER_ASSIGNED');
});

test('3. Reassignment, Staff Acceptance, and Work Started lifecycle', async () => {
  // Create an unassigned work order
  const wo = await MaintenanceWorkOrder.create({
    workOrderId: 'WO-2026-00002',
    title: 'Rewire corridor light switch',
    description: 'Switch is loose and sparks intermittently.',
    hostelId: testHostel._id,
    departmentId: testDept._id,
    createdBy: wardenUser._id,
    priority: 'MEDIUM',
    status: 'CREATED',
    auditLog: [{ action: 'CREATED', performedBy: wardenUser._id, newStatus: 'CREATED' }],
  });

  // Assign to staff 1
  const assignRes = await fetch(`${baseUrl}/api/work-orders/${wo._id}/assign`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${wardenToken}`,
    },
    body: JSON.stringify({ assignedTo: staffUser1._id }),
  });
  assert.equal(assignRes.status, 200);
  const assignBody = await assignRes.json();
  assert.equal(assignBody.data.status, 'ASSIGNED');
  assert.equal(String(assignBody.data.assignedTo), String(staffUser1._id));

  // Reassign to staff 2 (requires reason)
  const badReassignRes = await fetch(`${baseUrl}/api/work-orders/${wo._id}/reassign`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${wardenToken}`,
    },
    body: JSON.stringify({ assignedTo: staffUser2._id, reason: 'bad' }),
  });
  assert.equal(badReassignRes.status, 400);

  const goodReassignRes = await fetch(`${baseUrl}/api/work-orders/${wo._id}/reassign`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${wardenToken}`,
    },
    body: JSON.stringify({
      assignedTo: staffUser2._id,
      reason: 'Staff 1 is occupied on another high-priority job.',
    }),
  });
  assert.equal(goodReassignRes.status, 200);
  const reassignBody = await goodReassignRes.json();
  assert.equal(String(reassignBody.data.assignedTo), String(staffUser2._id));

  // Unauthorized staff 1 cannot accept staff 2's work order (403)
  const unauthAcceptRes = await fetch(`${baseUrl}/api/work-orders/${wo._id}/accept`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${staff1Token}` },
  });
  assert.equal(unauthAcceptRes.status, 403);

  // Staff 2 accepts work order
  const acceptRes = await fetch(`${baseUrl}/api/work-orders/${wo._id}/accept`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${staff2Token}` },
  });
  assert.equal(acceptRes.status, 200);
  const acceptBody = await acceptRes.json();
  assert.equal(acceptBody.data.status, 'ACCEPTED');

  // Staff 2 starts work
  const startRes = await fetch(`${baseUrl}/api/work-orders/${wo._id}/start`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${staff2Token}` },
  });
  assert.equal(startRes.status, 200);
  const startBody = await startRes.json();
  assert.equal(startBody.data.status, 'IN_PROGRESS');
  assert.ok(startBody.data.startedAt);
});

test('4. On Hold, Resume, and Completion with audit verification', async () => {
  const wo = await MaintenanceWorkOrder.create({
    workOrderId: 'WO-2026-00003',
    title: 'Replace burnt conduit pipe',
    description: 'Conduit pipe melted behind DB box.',
    hostelId: testHostel._id,
    departmentId: testDept._id,
    assignedTo: staffUser1._id,
    createdBy: wardenUser._id,
    priority: 'CRITICAL',
    status: 'IN_PROGRESS',
    startedAt: new Date(),
    auditLog: [{ action: 'STARTED', performedBy: staffUser1._id, newStatus: 'IN_PROGRESS' }],
  });

  // Put on hold (requires reason)
  const holdRes = await fetch(`${baseUrl}/api/work-orders/${wo._id}/hold`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${staff1Token}`,
    },
    body: JSON.stringify({ holdReason: 'Waiting for store room delivery of 25mm PVC pipe' }),
  });
  assert.equal(holdRes.status, 200);
  const holdBody = await holdRes.json();
  assert.equal(holdBody.data.status, 'ON_HOLD');
  assert.equal(holdBody.data.holdReason, 'Waiting for store room delivery of 25mm PVC pipe');

  // Resume work
  const resumeRes = await fetch(`${baseUrl}/api/work-orders/${wo._id}/resume`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${staff1Token}` },
  });
  assert.equal(resumeRes.status, 200);
  const resumeBody = await resumeRes.json();
  assert.equal(resumeBody.data.status, 'IN_PROGRESS');

  // Complete work order (requires completionNote)
  const badCompRes = await fetch(`${baseUrl}/api/work-orders/${wo._id}/complete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${staff1Token}`,
    },
    body: JSON.stringify({ completionNote: 'ok' }),
  });
  assert.equal(badCompRes.status, 400);

  const goodCompRes = await fetch(`${baseUrl}/api/work-orders/${wo._id}/complete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${staff1Token}`,
    },
    body: JSON.stringify({
      completionNote: 'Replaced burnt pipe and tested continuity across all 3 phases.',
    }),
  });
  assert.equal(goodCompRes.status, 200);
  const compBody = await goodCompRes.json();
  assert.equal(compBody.data.status, 'COMPLETED');
  assert.ok(compBody.data.completedAt);
  assert.equal(compBody.data.slaStatus, 'COMPLETED');

  // Cannot modify or complete an already completed work order
  const repeatCompRes = await fetch(`${baseUrl}/api/work-orders/${wo._id}/complete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${staff1Token}`,
    },
    body: JSON.stringify({ completionNote: 'Duplicate complete attempt' }),
  });
  assert.equal(repeatCompRes.status, 400);
});

test('5. Cancellation and SLA breach detection', async () => {
  // Test Cancellation
  const wo = await MaintenanceWorkOrder.create({
    workOrderId: 'WO-2026-00004',
    title: 'Duplicate ticket to cancel',
    description: 'Accidental submission of duplicate maintenance ticket.',
    hostelId: testHostel._id,
    departmentId: testDept._id,
    assignedTo: staffUser1._id,
    createdBy: wardenUser._id,
    status: 'ASSIGNED',
  });

  const cancelRes = await fetch(`${baseUrl}/api/work-orders/${wo._id}/cancel`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${wardenToken}`,
    },
    body: JSON.stringify({ cancellationReason: 'Duplicate work order; merged with WO-2026-00001' }),
  });
  assert.equal(cancelRes.status, 200);
  const cancelBody = await cancelRes.json();
  assert.equal(cancelBody.data.status, 'CANCELLED');
  assert.equal(cancelBody.data.slaStatus, 'CANCELLED');

  // Test SLA breach background monitoring
  const pastDue = new Date(Date.now() - 3600 * 1000); // 1 hour ago
  const overdueWo = await MaintenanceWorkOrder.create({
    workOrderId: 'WO-2026-00005',
    title: 'Overdue emergency motor check',
    description: 'Motor overheating in basement.',
    hostelId: testHostel._id,
    departmentId: testDept._id,
    assignedTo: staffUser1._id,
    createdBy: adminUser._id,
    status: 'IN_PROGRESS',
    dueAt: pastDue,
    slaStatus: 'ACTIVE',
  });

  // Run existing SLA scheduler cycle
  await processSlaAndEscalations();

  // Verify work order was automatically breached and notification sent
  const checkedWo = await MaintenanceWorkOrder.findById(overdueWo._id);
  assert.equal(checkedWo.slaStatus, 'BREACHED');
  assert.ok(checkedWo.slaBreachedAt);
  assert.ok(checkedWo.auditLog.some((a) => a.action === 'SLA_BREACHED'));

  const breachNotif = await Notification.findOne({
    recipient: staffUser1._id,
    relatedEntityId: overdueWo._id,
    type: 'WORK_ORDER_SLA_BREACHED',
  });
  assert.ok(breachNotif);
});

test('6. Work Orders Filtering, Search, Pagination, and Dashboard Metrics', async () => {
  // Metrics stats endpoint
  const statsRes = await fetch(`${baseUrl}/api/work-orders/stats`, {
    headers: { Authorization: `Bearer ${wardenToken}` },
  });
  assert.equal(statsRes.status, 200);
  const statsBody = await statsRes.json();
  assert.equal(statsBody.success, true);
  assert.ok(statsBody.data.total >= 4);
  assert.ok(typeof statsBody.data.completed === 'number');
  assert.ok(typeof statsBody.data.overdue === 'number');

  // List with filter by status
  const filterRes = await fetch(`${baseUrl}/api/work-orders?status=COMPLETED`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(filterRes.status, 200);
  const filterBody = await filterRes.json();
  assert.ok(filterBody.data.every((w) => w.status === 'COMPLETED'));

  // Search by Work Order ID
  const searchRes = await fetch(`${baseUrl}/api/work-orders?search=WO-2026-00002`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(searchRes.status, 200);
  const searchBody = await searchRes.json();
  assert.equal(searchBody.data.length, 1);
  assert.equal(searchBody.data[0].workOrderId, 'WO-2026-00002');
});

test('7. Asset Maintenance History returns chronological work orders and metrics', async () => {
  const asset = await Asset.create({
    assetId: 'AST-2026-00005',
    name: 'Submersible Pump 5HP',
    assetType: 'PLUMBING_FIXTURE',
    category: 'PLUMBING',
    hostelId: testHostel._id,
    departmentId: testDept._id,
  });

  // Create completed work order for this asset
  await MaintenanceWorkOrder.create({
    workOrderId: 'WO-2026-00010',
    assetId: asset._id,
    title: 'Pump Seal Replacement',
    description: 'Replaced mechanical shaft seal.',
    hostelId: testHostel._id,
    departmentId: testDept._id,
    assignedTo: staffUser1._id,
    createdBy: adminUser._id,
    status: 'COMPLETED',
    completedAt: new Date(),
  });

  const historyRes = await fetch(`${baseUrl}/api/assets/${asset._id}/maintenance-history`, {
    headers: { Authorization: `Bearer ${wardenToken}` },
  });
  assert.equal(historyRes.status, 200);
  const historyBody = await historyRes.json();
  assert.equal(historyBody.success, true);
  assert.equal(historyBody.data.totalWorkOrders, 1);
  assert.equal(historyBody.data.completedWorkOrders, 1);
  assert.equal(historyBody.data.workOrders[0].workOrderId, 'WO-2026-00010');
});
