import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_for_suite_1234567890abcdef';
process.env.JWT_EXPIRES_IN = '1h';

const baseUri = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/bbdu_hosteller_test';
const TEST_URI = baseUri.replace(/\/([^/?]+)(\?.*)?$/, '/$1_sla$2');

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
  ComplaintAssignment,
  ComplaintEscalation,
  ComplaintSlaCycle,
  SlaRule,
  EscalationRule,
} = await import('../src/models/index.js');
const { hashPassword } = await import('../src/utils/password.js');
const { signToken } = await import('../src/utils/jwt.js');
const { processSlaAndEscalations, startSlaForComplaint } = await import('../src/services/sla.service.js');

let server;
let baseUrl;

let adminToken;
let wardenToken;
let staffToken;
let studentToken;
let authorityToken;

let testHostel;
let testBlock;
let testFloor;
let testRoom;
let testDept;

let adminUser;
let wardenUser;
let staffUser;
let studentUser;
let authorityUser;

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
    ComplaintAssignment,
    ComplaintEscalation,
    ComplaintSlaCycle,
    SlaRule,
    EscalationRule,
  ].map((m) => m.syncIndexes()));

  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });

  const pw = await hashPassword('Password@123');

  testHostel = await Hostel.create({
    name: 'Tagore Hostel SLA',
    code: 'TH-SLA',
    type: 'BOYS',
    address: 'BBDU Campus, Lucknow',
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
    name: 'Electrical SLA Dept',
    code: 'ELEC-SLA',
    type: 'MAINTENANCE',
  });

  // Create Users
  adminUser = await User.create({
    name: 'Admin SLA',
    email: 'admin_sla@bbdu.ac.in',
    passwordHash: pw,
    role: 'SUPER_ADMIN',
  });
  adminToken = signToken({ userId: adminUser._id, role: adminUser.role });

  authorityUser = await User.create({
    name: 'Dean Authority SLA',
    email: 'dean_sla@bbdu.ac.in',
    passwordHash: pw,
    role: 'AUTHORITY',
  });
  authorityToken = signToken({ userId: authorityUser._id, role: authorityUser.role });

  wardenUser = await User.create({
    name: 'Warden SLA',
    email: 'warden_sla@bbdu.ac.in',
    passwordHash: pw,
    role: 'WARDEN',
    hostelId: testHostel._id,
  });
  wardenToken = signToken({ userId: wardenUser._id, role: wardenUser.role });

  staffUser = await User.create({
    name: 'Staff Electrician SLA',
    email: 'staff_sla@bbdu.ac.in',
    passwordHash: pw,
    role: 'HOSTEL_STAFF',
    departmentId: testDept._id,
  });
  staffToken = signToken({ userId: staffUser._id, role: staffUser.role });

  studentUser = await User.create({
    name: 'Student SLA',
    email: 'student_sla@bbdu.ac.in',
    passwordHash: pw,
    role: 'STUDENT',
    studentId: 'STU-SLA-001',
    hostelId: testHostel._id,
    blockId: testBlock._id,
    floorId: testFloor._id,
    roomId: testRoom._id,
  });
  studentToken = signToken({ userId: studentUser._id, role: studentUser.role });
});

after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await disconnectDB();
});

// Helper for fetch requests
async function apiRequest(path, options = {}) {
  const url = `${baseUrl}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    ...(options.headers || {}),
  };
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  let data;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, data };
}

test('1. RBAC Guard on SLA and Escalation rules endpoints', async () => {
  // STUDENT accessing SLA rules should receive 403
  const res1 = await apiRequest('/api/sla-rules', { token: studentToken });
  assert.equal(res1.status, 403);

  // HOSTEL_STAFF accessing SLA rules should receive 403
  const res2 = await apiRequest('/api/sla-rules', { token: staffToken });
  assert.equal(res2.status, 403);

  // WARDEN accessing SLA rules should receive 403
  const res3 = await apiRequest('/api/sla-rules', { token: wardenToken });
  assert.equal(res3.status, 403);

  // SUPER_ADMIN accessing SLA rules should receive 200
  const res4 = await apiRequest('/api/sla-rules', { token: adminToken });
  assert.equal(res4.status, 200);
  assert.equal(res4.data.success, true);
  assert.ok(Array.isArray(res4.data.data));
});

test('2. SUPER_ADMIN CRUD operations on SLA Rules', async () => {
  // Create an SLA rule for ELECTRICAL / HIGH
  const createRes = await apiRequest('/api/sla-rules', {
    method: 'POST',
    token: adminToken,
    body: {
      name: 'High Priority Electrical SLA',
      code: 'SLA-ELEC-HIGH',
      priority: 'HIGH',
      category: 'ELECTRICAL',
      resolutionHours: 12,
      reminderThresholdPercent: 75,
      escalationEnabled: true,
      description: 'Resolution within 12 hours for high priority electrical issues',
    },
  });

  assert.equal(createRes.status, 201);
  assert.equal(createRes.data.success, true);
  const createdRule = createRes.data.data;
  assert.equal(createdRule.code, 'SLA-ELEC-HIGH');
  assert.equal(createdRule.resolutionHours, 12);

  // Update the SLA rule
  const updateRes = await apiRequest(`/api/sla-rules/${createdRule._id}`, {
    method: 'PATCH',
    token: adminToken,
    body: {
      resolutionHours: 8,
      reminderThresholdPercent: 80,
    },
  });
  assert.equal(updateRes.status, 200);
  assert.equal(updateRes.data.data.resolutionHours, 8);
  assert.equal(updateRes.data.data.reminderThresholdPercent, 80);

  // Toggle active status
  const toggleRes = await apiRequest(`/api/sla-rules/${createdRule._id}/status`, {
    method: 'PATCH',
    token: adminToken,
  });
  assert.equal(toggleRes.status, 200);
  assert.equal(toggleRes.data.data.isActive, false);

  // Re-enable it for subsequent tests
  await apiRequest(`/api/sla-rules/${createdRule._id}/status`, {
    method: 'PATCH',
    token: adminToken,
  });
});

test('3. SUPER_ADMIN CRUD operations on Escalation Rules', async () => {
  // Create Level 1 rule: HOSTEL_STAFF -> WARDEN
  const resLvl1 = await apiRequest('/api/escalation-rules', {
    method: 'POST',
    token: adminToken,
    body: {
      name: 'Level 1: Staff to Warden',
      code: 'ESC-LVL1-TEST',
      escalationLevel: 1,
      fromRole: 'HOSTEL_STAFF',
      toRole: 'WARDEN',
      nextAuthorityRole: 'WARDEN',
      resolutionHours: 24,
      isActive: true,
    },
  });
  assert.equal(resLvl1.status, 201);
  assert.equal(resLvl1.data.data.escalationLevel, 1);

  // Create Level 2 rule: WARDEN -> AUTHORITY
  const resLvl2 = await apiRequest('/api/escalation-rules', {
    method: 'POST',
    token: adminToken,
    body: {
      name: 'Level 2: Warden to Authority',
      code: 'ESC-LVL2-TEST',
      escalationLevel: 2,
      fromRole: 'WARDEN',
      toRole: 'AUTHORITY',
      nextAuthorityRole: 'AUTHORITY',
      resolutionHours: 12,
      isActive: true,
    },
  });
  assert.equal(resLvl2.status, 201);
  assert.equal(resLvl2.data.data.escalationLevel, 2);

  // List escalation rules
  const listRes = await apiRequest('/api/escalation-rules', { token: adminToken });
  assert.equal(listRes.status, 200);
  assert.ok(listRes.data.data.length >= 2);
});

test('4. Operational Assignment activates SLA and starts cycle', async () => {
  // Student submits a HIGH priority Electrical complaint
  const subRes = await apiRequest('/api/complaints', {
    method: 'POST',
    token: studentToken,
    body: {
      title: 'Power Outage in Room 101',
      category: 'ELECTRICAL',
      issueType: 'ELECTRICITY_FAILURE',
      priority: 'HIGH',
      description: 'Complete power loss in room 101, MCB tripped.',
    },
  });
  assert.equal(subRes.status, 201);
  const complaintId = subRes.data.data._id;

  // Warden triages the complaint
  const triageRes = await apiRequest(`/api/complaints/${complaintId}/triage`, {
    method: 'PATCH',
    token: wardenToken,
    body: {
      priority: 'HIGH',
      departmentId: testDept._id.toString(),
      triageNotes: 'Confirmed electrical failure.',
    },
  });
  assert.equal(triageRes.status, 200);

  // Warden assigns to Staff
  const assignRes = await apiRequest(`/api/complaints/${complaintId}/assign`, {
    method: 'PATCH',
    token: wardenToken,
    body: {
      assignedTo: staffUser._id.toString(),
      notes: 'Please inspect MCB board immediately.',
    },
  });
  assert.equal(assignRes.status, 200);

  // Verify Complaint SLA state in database
  const complaint = await Complaint.findById(complaintId);
  assert.equal(complaint.slaStatus, 'ACTIVE');
  assert.ok(complaint.slaStartedAt instanceof Date);
  assert.ok(complaint.slaDueAt instanceof Date);
  assert.ok(complaint.slaDueAt > complaint.slaStartedAt);
  assert.equal(complaint.currentEscalationLevel, 0);

  // Verify ComplaintSlaCycle record was created
  const cycles = await ComplaintSlaCycle.find({ complaintId });
  assert.equal(cycles.length, 1);
  assert.equal(cycles[0].cycleNumber, 1);
  assert.equal(cycles[0].status, 'ACTIVE');
  assert.equal(complaint.assignedTo.toString(), staffUser._id.toString());

  // Staff acknowledges and starts work
  await apiRequest(`/api/complaints/${complaintId}/acknowledge`, {
    method: 'PATCH',
    token: staffToken,
  });
  await apiRequest(`/api/complaints/${complaintId}/start`, {
    method: 'PATCH',
    token: staffToken,
  });

  // Verify SLA info endpoint
  const slaInfoRes = await apiRequest(`/api/complaints/${complaintId}/sla`, {
    token: staffToken,
  });
  assert.equal(slaInfoRes.status, 200);
  assert.equal(slaInfoRes.data.success, true);
  assert.equal(slaInfoRes.data.data.slaStatus, 'ACTIVE');
  assert.ok(typeof slaInfoRes.data.data.remainingMs === 'number');
});

test('5. SlaScheduler detects reminder threshold (75% elapsed)', async () => {
  // Create a complaint and backdate slaStartedAt to 80% elapsed
  const subRes = await apiRequest('/api/complaints', {
    method: 'POST',
    token: studentToken,
    body: {
      title: 'Socket Broken',
      category: 'ELECTRICAL',
      issueType: 'SWITCH_SOCKET_ISSUE',
      priority: 'HIGH',
      description: 'Socket sparking on wall.',
    },
  });
  assert.equal(subRes.status, 201);
  const complaintId = subRes.data.data._id;

  await apiRequest(`/api/complaints/${complaintId}/triage`, {
    method: 'PATCH',
    token: wardenToken,
    body: { departmentId: testDept._id.toString() },
  });

  await apiRequest(`/api/complaints/${complaintId}/assign`, {
    method: 'PATCH',
    token: wardenToken,
    body: { assignedTo: staffUser._id.toString() },
  });

  // Backdate complaint to 80% through SLA duration (8-hour rule = 480 mins)
  // 80% elapsed = 384 mins ago, 96 mins left until due
  const now = Date.now();
  const startedAt = new Date(now - 384 * 60 * 1000);
  const dueAt = new Date(now + 96 * 60 * 1000);
  const reminderDueAt = new Date(startedAt.getTime() + (dueAt.getTime() - startedAt.getTime()) * 0.75);

  await Complaint.findByIdAndUpdate(complaintId, {
    slaStartedAt: startedAt,
    slaDueAt: dueAt,
    reminderSentAt: null,
  });

  await ComplaintSlaCycle.findOneAndUpdate(
    { complaintId, status: 'ACTIVE' },
    { startedAt, dueAt, reminderDueAt, reminderSentAt: null }
  );

  // Run SLA processing
  const result = await processSlaAndEscalations();
  assert.ok(result.remindersRecorded >= 1);

  // Check database that reminderSentAt was recorded
  const updatedComplaint = await Complaint.findById(complaintId);
  assert.ok(updatedComplaint.reminderSentAt instanceof Date);

  // Idempotency: Running again should NOT resend reminder for the same cycle
  const result2 = await processSlaAndEscalations();
  const updatedAgain = await Complaint.findById(complaintId);
  assert.equal(
    updatedComplaint.reminderSentAt.getTime(),
    updatedAgain.reminderSentAt.getTime()
  );
});

test('6. SLA Breach triggers automatic escalation to Level 1 (Staff -> Warden)', async () => {
  // Create a complaint assigned to Staff
  const subRes = await apiRequest('/api/complaints', {
    method: 'POST',
    token: studentToken,
    body: {
      title: 'Exhaust Fan Stopped',
      category: 'ELECTRICAL',
      issueType: 'FAN_NOT_WORKING',
      priority: 'HIGH',
      description: 'Exhaust fan burned out.',
    },
  });
  assert.equal(subRes.status, 201);
  const complaintId = subRes.data.data._id;

  await apiRequest(`/api/complaints/${complaintId}/triage`, {
    method: 'PATCH',
    token: wardenToken,
    body: { departmentId: testDept._id.toString() },
  });

  await apiRequest(`/api/complaints/${complaintId}/assign`, {
    method: 'PATCH',
    token: wardenToken,
    body: { assignedTo: staffUser._id.toString() },
  });

  // Backdate deadline into the past to simulate breach
  const pastDue = new Date(Date.now() - 15 * 60 * 1000); // 15 mins ago
  await Complaint.findByIdAndUpdate(complaintId, {
    slaDueAt: pastDue,
  });

  // Run SLA processor
  const result = await processSlaAndEscalations();
  assert.ok(result.escalationsTriggered >= 1);

  // Verify complaint state after automatic escalation
  const escalatedComplaint = await Complaint.findById(complaintId);
  assert.equal(escalatedComplaint.slaStatus, 'ACTIVE'); // Reset for new escalation cycle
  assert.equal(escalatedComplaint.currentEscalationLevel, 1);
  assert.equal(escalatedComplaint.escalationCount, 1);
  assert.equal(escalatedComplaint.assignedTo.toString(), wardenUser._id.toString());
  assert.ok(escalatedComplaint.slaBreachedAt instanceof Date);
  assert.ok(escalatedComplaint.slaDueAt > new Date()); // Fresh deadline for Level 1

  // Verify ComplaintEscalation audit log was created
  const escalations = await ComplaintEscalation.find({ complaintId });
  assert.equal(escalations.length, 1);
  assert.equal(escalations[0].escalationLevel, 1);
  assert.equal(escalations[0].fromRole, 'HOSTEL_STAFF');
  assert.equal(escalations[0].toRole, 'WARDEN');
  assert.equal(escalations[0].fromUserId.toString(), staffUser._id.toString());
  assert.equal(escalations[0].toUserId.toString(), wardenUser._id.toString());
  assert.equal(escalations[0].triggeredBy, 'SYSTEM');

  // Verify Escalations API endpoint
  const escApiRes = await apiRequest(`/api/complaints/${complaintId}/escalations`, {
    token: wardenToken,
  });
  assert.equal(escApiRes.status, 200);
  assert.equal(escApiRes.data.data.length, 1);
  assert.equal(escApiRes.data.data[0].escalationLevel, 1);

  // Verify ComplaintAssignment history was updated
  const assignments = await ComplaintAssignment.find({ complaintId }).sort({ assignedAt: 1 });
  assert.equal(assignments.length, 2);
  assert.equal(assignments[0].isCurrent, false); // old staff assignment deactivated
  assert.equal(assignments[1].isCurrent, true); // new warden assignment active
  assert.equal(assignments[1].assignedTo.toString(), wardenUser._id.toString());
});

test('7. Multi-Level Escalation: Level 1 breach escalates to Level 2 (Warden -> Authority)', async () => {
  // Find the complaint escalated to Warden in test 6
  const complaints = await Complaint.find({ currentEscalationLevel: 1 });
  assert.ok(complaints.length > 0);
  const complaint = complaints[0];

  // Backdate its Level 1 deadline into the past
  const pastDue = new Date(Date.now() - 30 * 60 * 1000);
  await Complaint.findByIdAndUpdate(complaint._id, {
    slaDueAt: pastDue,
  });

  // Run SLA processor
  const result = await processSlaAndEscalations();
  assert.ok(result.escalationsTriggered >= 1);

  // Verify complaint state after Level 2 escalation
  const lvl2Complaint = await Complaint.findById(complaint._id);
  assert.equal(lvl2Complaint.currentEscalationLevel, 2);
  assert.equal(lvl2Complaint.escalationCount, 2);
  assert.equal(lvl2Complaint.assignedTo.toString(), authorityUser._id.toString());

  // Verify ComplaintEscalation records has both Level 1 and Level 2
  const escalations = await ComplaintEscalation.find({ complaintId: complaint._id }).sort({ escalationLevel: 1 });
  assert.equal(escalations.length, 2);
  assert.equal(escalations[1].escalationLevel, 2);
  assert.equal(escalations[1].fromRole, 'WARDEN');
  assert.equal(escalations[1].toRole, 'AUTHORITY');
  assert.equal(escalations[1].toUserId.toString(), authorityUser._id.toString());
});

test('8. Resolved or Closed complaints are NEVER escalated on deadline passage', async () => {
  // Create complaint, assign, resolve it
  const subRes = await apiRequest('/api/complaints', {
    method: 'POST',
    token: studentToken,
    body: {
      title: 'Switch Loose',
      category: 'ELECTRICAL',
      issueType: 'SWITCH_SOCKET_ISSUE',
      priority: 'HIGH',
      description: 'Switch loose on wall.',
    },
  });
  assert.equal(subRes.status, 201);
  const complaintId = subRes.data.data._id;

  await apiRequest(`/api/complaints/${complaintId}/triage`, {
    method: 'PATCH',
    token: wardenToken,
    body: { departmentId: testDept._id.toString() },
  });

  await apiRequest(`/api/complaints/${complaintId}/assign`, {
    method: 'PATCH',
    token: wardenToken,
    body: { assignedTo: staffUser._id.toString() },
  });

  await apiRequest(`/api/complaints/${complaintId}/acknowledge`, {
    method: 'PATCH',
    token: staffToken,
  });

  await apiRequest(`/api/complaints/${complaintId}/start`, {
    method: 'PATCH',
    token: staffToken,
  });

  // Resolve complaint
  await apiRequest(`/api/complaints/${complaintId}/resolve`, {
    method: 'PATCH',
    token: staffToken,
    body: { resolutionNote: 'Switch replaced with a brand new anchor switch.' },
  });

  // Backdate deadline into past
  await Complaint.findByIdAndUpdate(complaintId, {
    slaDueAt: new Date(Date.now() - 3600 * 1000),
  });

  // Run SLA processor
  const beforeEscalations = await ComplaintEscalation.countDocuments({ complaintId });
  await processSlaAndEscalations();
  const afterEscalations = await ComplaintEscalation.countDocuments({ complaintId });

  // Assert NO new escalations occurred
  assert.equal(beforeEscalations, afterEscalations);
  const complaintAfter = await Complaint.findById(complaintId);
  assert.equal(complaintAfter.currentEscalationLevel, 0);
  assert.equal(complaintAfter.status, 'STUDENT_VERIFICATION');
});

test('9. Admin manual trigger endpoint executes SLA processing and returns summary', async () => {
  const res = await apiRequest('/api/sla-rules/run-scheduler', {
    method: 'POST',
    token: adminToken,
  });

  assert.equal(res.status, 200);
  assert.equal(res.data.success, true);
  assert.ok(typeof res.data.data.processedCount === 'number');
  assert.ok(typeof res.data.data.remindersRecorded === 'number');
  assert.ok(typeof res.data.data.escalationsTriggered === 'number');
});

test('10. Automatic Escalation from Warden directly escalates to Authority (Level 2)', async () => {
  // Student submits a complaint
  const subRes = await apiRequest('/api/complaints', {
    method: 'POST',
    token: studentToken,
    body: {
      title: 'Geyser Heating Coil Damaged',
      category: 'ELECTRICAL',
      issueType: 'OTHER_ELECTRICAL',
      priority: 'HIGH',
      description: 'Geyser heating coil is damaged and not warming water.',
    },
  });
  assert.equal(subRes.status, 201);
  const complaintId = subRes.data.data._id;

  // Triaged
  await apiRequest(`/api/complaints/${complaintId}/triage`, {
    method: 'PATCH',
    token: wardenToken,
    body: { departmentId: testDept._id.toString() },
  });

  // Assigned directly to Warden
  await apiRequest(`/api/complaints/${complaintId}/assign`, {
    method: 'PATCH',
    token: wardenToken,
    body: { assignedTo: wardenUser._id.toString(), notes: 'Warden personal supervision required.' },
  });

  // Verify initial assignment to Warden
  const initialComplaint = await Complaint.findById(complaintId);
  assert.equal(initialComplaint.assignedTo.toString(), wardenUser._id.toString());
  assert.equal(initialComplaint.slaStatus, 'ACTIVE');

  // Backdate deadline into past
  await Complaint.findByIdAndUpdate(complaintId, {
    slaDueAt: new Date(Date.now() - 10 * 60 * 1000),
  });

  // Run processor
  const result = await processSlaAndEscalations();
  assert.ok(result.escalationsTriggered >= 1);

  // Verify escalated to Authority (Level 2)
  const escalatedComplaint = await Complaint.findById(complaintId);
  assert.equal(escalatedComplaint.currentEscalationLevel, 2);
  assert.equal(escalatedComplaint.assignedTo.toString(), authorityUser._id.toString());
  assert.equal(escalatedComplaint.slaStatus, 'ACTIVE'); // Fresh SLA cycle started

  // Verify escalation history record has all required fields
  const escalations = await ComplaintEscalation.find({ complaintId });
  assert.equal(escalations.length, 1);
  assert.equal(escalations[0].fromRole, 'WARDEN');
  assert.equal(escalations[0].toRole, 'AUTHORITY');
  assert.equal(escalations[0].fromUserId.toString(), wardenUser._id.toString());
  assert.equal(escalations[0].toUserId.toString(), authorityUser._id.toString());
  assert.ok(escalations[0].reason);
  assert.ok(escalations[0].triggeredAt instanceof Date);

  // Idempotency check: Running processor again should NOT escalate further while within fresh cycle
  await processSlaAndEscalations();
  const escalationsAgain = await ComplaintEscalation.find({ complaintId });
  assert.equal(escalationsAgain.length, 1);
});

test('11. Complete Escalation History audit endpoint returns all required fields', async () => {
  // Find a complaint that has escalations
  const escalated = await Complaint.findOne({ currentEscalationLevel: { $gt: 0 } });
  assert.ok(escalated);

  const res = await apiRequest(`/api/complaints/${escalated._id}/escalations`, {
    token: adminToken,
  });

  assert.equal(res.status, 200);
  assert.equal(res.data.success, true);
  assert.ok(res.data.data.length > 0);

  const firstEsc = res.data.data[0];
  assert.ok(firstEsc.complaintId);
  assert.ok(firstEsc.toUserId);
  assert.ok(firstEsc.fromRole);
  assert.ok(firstEsc.toRole);
  assert.ok(firstEsc.escalationLevel);
  assert.ok(firstEsc.reason);
  assert.ok(firstEsc.triggeredAt);
});

test('12. Duplicate-Protection: Repeated background worker execution is safe and idempotent', async () => {
  // Count baseline records
  const baselineEscalations = await ComplaintEscalation.countDocuments();
  const baselineCycles = await ComplaintSlaCycle.countDocuments();

  // Run the scheduler 3 consecutive times
  await processSlaAndEscalations();
  await processSlaAndEscalations();
  await processSlaAndEscalations();

  // Verify counts did not increase
  const afterEscalations = await ComplaintEscalation.countDocuments();
  const afterCycles = await ComplaintSlaCycle.countDocuments();

  assert.equal(baselineEscalations, afterEscalations);
  assert.equal(baselineCycles, afterCycles);
});

test('13. API Verification: Safe error responses and validation guards', async () => {
  // 1. Non-existent complaint ID for SLA details returns 404
  const fakeId = new mongoose.Types.ObjectId();
  const notFoundSla = await apiRequest(`/api/complaints/${fakeId}/sla`, {
    token: adminToken,
  });
  assert.equal(notFoundSla.status, 404);
  assert.equal(notFoundSla.data.success, false);

  // 2. Non-existent complaint ID for escalations returns 404
  const notFoundEsc = await apiRequest(`/api/complaints/${fakeId}/escalations`, {
    token: adminToken,
  });
  assert.equal(notFoundEsc.status, 404);
  assert.equal(notFoundEsc.data.success, false);

  // 3. Non-existent SLA Rule returns 404
  const notFoundRule = await apiRequest(`/api/sla-rules/${fakeId}`, {
    token: adminToken,
  });
  assert.equal(notFoundRule.status, 404);
  assert.equal(notFoundRule.data.success, false);

  // 4. Duplicate SLA Rule code returns 409 Conflict
  const dupRule = await apiRequest('/api/sla-rules', {
    method: 'POST',
    token: adminToken,
    body: {
      name: 'Duplicate Rule Test',
      code: 'SLA-ELEC-HIGH', // already created in test 2
      priority: 'HIGH',
      resolutionHours: 24,
    },
  });
  assert.equal(dupRule.status, 409);
  assert.equal(dupRule.data.success, false);

  // 5. Missing required fields in SLA Rule returns 400 Bad Request
  const badRule = await apiRequest('/api/sla-rules', {
    method: 'POST',
    token: adminToken,
    body: {
      name: 'Incomplete Rule',
    },
  });
  assert.equal(badRule.status, 400);
  assert.equal(badRule.data.success, false);
});

test('14. SLA Countdown & State Distinction: Within SLA vs Near Deadline vs Breached', async () => {
  // Create complaint
  const subRes = await apiRequest('/api/complaints', {
    method: 'POST',
    token: studentToken,
    body: {
      title: 'Water Cooler Power Cord Cut',
      category: 'ELECTRICAL',
      issueType: 'OTHER_ELECTRICAL',
      priority: 'HIGH',
      description: 'Power cord was severed near wall socket.',
    },
  });
  const complaintId = subRes.data.data._id;

  await apiRequest(`/api/complaints/${complaintId}/triage`, {
    method: 'PATCH',
    token: wardenToken,
    body: { departmentId: testDept._id.toString() },
  });

  await apiRequest(`/api/complaints/${complaintId}/assign`, {
    method: 'PATCH',
    token: wardenToken,
    body: { assignedTo: staffUser._id.toString() },
  });

  // State 1: Within SLA (plenty of time left)
  const slaState1 = await apiRequest(`/api/complaints/${complaintId}/sla`, { token: staffToken });
  assert.equal(slaState1.data.data.slaStatus, 'ACTIVE');
  assert.ok(slaState1.data.data.remainingMs > 0);
  assert.equal(slaState1.data.data.isBreached, false);

  // State 2: Near Deadline (elapsed past 75% reminder threshold)
  const now = Date.now();
  const startedAt = new Date(now - 390 * 60 * 1000);
  const dueAt = new Date(now + 90 * 60 * 1000);
  const reminderDueAt = new Date(startedAt.getTime() + (dueAt.getTime() - startedAt.getTime()) * 0.75);

  await Complaint.findByIdAndUpdate(complaintId, {
    slaStartedAt: startedAt,
    slaDueAt: dueAt,
    reminderSentAt: null,
  });
  await ComplaintSlaCycle.findOneAndUpdate(
    { complaintId, status: 'ACTIVE' },
    { startedAt, dueAt, reminderDueAt, reminderSentAt: null }
  );

  await processSlaAndEscalations();

  const slaState2 = await apiRequest(`/api/complaints/${complaintId}/sla`, { token: staffToken });
  assert.equal(slaState2.data.data.slaStatus, 'ACTIVE');
  assert.ok(slaState2.data.data.reminderSentAt !== null); // Reminder recorded (due soon)

  // State 3: SLA Breached
  await Complaint.findByIdAndUpdate(complaintId, {
    slaDueAt: new Date(now - 60 * 1000), // overdue by 1 min
  });

  const slaState3 = await apiRequest(`/api/complaints/${complaintId}/sla`, { token: staffToken });
  assert.equal(slaState3.data.data.isBreached, true);
  assert.equal(slaState3.data.data.remainingMs, 0);
});

test('15. SUPER_ADMIN can retrieve and update consolidated SLA configuration & escalation parameters', async () => {
  // 1. GET initial configuration
  const getRes = await apiRequest('/api/sla-rules/config', { token: adminToken });
  assert.equal(getRes.status, 200);
  assert.ok(getRes.data.success);
  assert.ok(getRes.data.data.staffToWardenHours !== undefined);
  assert.ok(getRes.data.data.wardenToAuthorityHours !== undefined);
  assert.ok(getRes.data.data.reminderThresholdPercent !== undefined);
  assert.ok(getRes.data.data.priorityDurations !== undefined);

  // 2. PUT updated configuration
  const updateRes = await apiRequest('/api/sla-rules/config', {
    method: 'PUT',
    token: adminToken,
    body: {
      staffToWardenHours: 18,
      wardenToAuthorityHours: 12,
      authorityToAdminHours: 36,
      reminderThresholdPercent: 80,
      escalationEnabled: true,
      priorityDurations: {
        CRITICAL: 2,
        HIGH: 16,
        MEDIUM: 36,
        LOW: 60,
      },
    },
  });

  assert.equal(updateRes.status, 200);
  assert.ok(updateRes.data.success);
  assert.equal(updateRes.data.data.staffToWardenHours, 18);
  assert.equal(updateRes.data.data.wardenToAuthorityHours, 12);
  assert.equal(updateRes.data.data.authorityToAdminHours, 36);
  assert.equal(updateRes.data.data.reminderThresholdPercent, 80);
  assert.equal(updateRes.data.data.priorityDurations.CRITICAL, 2);
  assert.equal(updateRes.data.data.priorityDurations.HIGH, 16);

  // 3. Verify changes persisted in database models
  const escLvl1 = await EscalationRule.findOne({ escalationLevel: 1 });
  assert.equal(escLvl1.resolutionHours, 18);

  const escLvl2 = await EscalationRule.findOne({ escalationLevel: 2 });
  assert.equal(escLvl2.resolutionHours, 12);

  const criticalRule = await SlaRule.findOne({ priority: 'CRITICAL', category: null, departmentId: null });
  assert.equal(criticalRule.resolutionHours, 2);
  assert.equal(criticalRule.reminderThresholdPercent, 80);
});

test('16. Non-admin roles (WARDEN, STAFF, STUDENT, AUTHORITY) cannot view or update SLA configuration (403 Forbidden)', async () => {
  // Test unauthorized GET
  for (const [roleName, token] of [
    ['WARDEN', wardenToken],
    ['STAFF', staffToken],
    ['STUDENT', studentToken],
    ['AUTHORITY', authorityToken],
  ]) {
    const getRes = await apiRequest('/api/sla-rules/config', { token });
    assert.equal(getRes.status, 403, `${roleName} should be forbidden from reading SLA configuration`);

    const putRes = await apiRequest('/api/sla-rules/config', {
      method: 'PUT',
      token,
      body: { staffToWardenHours: 10 },
    });
    assert.equal(putRes.status, 403, `${roleName} should be forbidden from modifying SLA configuration`);
  }
});

test('17. Validation guards reject invalid SLA durations and reminder thresholds (400 Bad Request)', async () => {
  // Negative duration
  const res1 = await apiRequest('/api/sla-rules/config', {
    method: 'PUT',
    token: adminToken,
    body: { staffToWardenHours: -5 },
  });
  assert.equal(res1.status, 400);

  // Out of range reminder percentage
  const res2 = await apiRequest('/api/sla-rules/config', {
    method: 'PUT',
    token: adminToken,
    body: { reminderThresholdPercent: 150 },
  });
  assert.equal(res2.status, 400);

  const res3 = await apiRequest('/api/sla-rules/config', {
    method: 'PUT',
    token: adminToken,
    body: { reminderThresholdPercent: 0 },
  });
  assert.equal(res3.status, 400);
});

test('18. Step 5.5: Live SLA & Automatic Escalation Pipeline verification endpoint', async () => {
  // 1. Non-admin access rejected (403 Forbidden)
  const forbiddenRes = await apiRequest('/api/sla-rules/verify-pipeline', {
    method: 'POST',
    token: studentToken,
  });
  assert.equal(forbiddenRes.status, 403);

  // 2. Super admin runs full end-to-end diagnostic pipeline (200 OK)
  const verifyRes = await apiRequest('/api/sla-rules/verify-pipeline', {
    method: 'POST',
    token: adminToken,
  });

  assert.equal(verifyRes.status, 200);
  assert.ok(verifyRes.data.success);
  assert.ok(verifyRes.data.data.checks.length >= 6);
  assert.equal(verifyRes.data.data.passedChecks, verifyRes.data.data.totalChecks);
  assert.ok(verifyRes.data.data.durationMs >= 0);

  // Verify test complaint was completely cleaned up
  const leftoverTestComplaints = await Complaint.find({
    title: /Diagnostic Pipeline Test/,
  });
  assert.equal(leftoverTestComplaints.length, 0, 'Test complaint should be cleaned up after diagnostic');
});

test('19. Reopened complaint initiates fresh SLA cycle and avoids premature escalation', async () => {
  // Create, triage, assign, ack, start, and resolve complaint
  const subRes = await apiRequest('/api/complaints', {
    method: 'POST',
    token: studentToken,
    body: {
      title: 'Water Tap Leaking in Washroom',
      category: 'ELECTRICAL',
      issueType: 'ELECTRICITY_FAILURE',
      priority: 'MEDIUM',
      description: 'The main MCB in washroom corridor trips continuously.',
    },
  });
  assert.equal(subRes.status, 201);
  const complaintId = subRes.data.data._id;

  await apiRequest(`/api/complaints/${complaintId}/triage`, {
    method: 'PATCH',
    token: wardenToken,
    body: { triageNote: 'Triaged electrical issue' },
  });

  await apiRequest(`/api/complaints/${complaintId}/assign`, {
    method: 'PATCH',
    token: wardenToken,
    body: {
      departmentId: testDept._id.toString(),
      assignedTo: staffUser._id.toString(),
      reason: 'Assigned to electrician',
    },
  });

  await apiRequest(`/api/complaints/${complaintId}/acknowledge`, {
    method: 'PATCH',
    token: staffToken,
  });

  await apiRequest(`/api/complaints/${complaintId}/start`, {
    method: 'PATCH',
    token: staffToken,
  });

  await apiRequest(`/api/complaints/${complaintId}/resolve`, {
    method: 'PATCH',
    token: staffToken,
    body: { resolutionNote: 'Replaced MCB breaker and tightened wiring terminals.' },
  });

  // Student rejects resolution (REOPENED)
  const rejectRes = await apiRequest(`/api/complaints/${complaintId}/verify`, {
    method: 'PATCH',
    token: studentToken,
    body: {
      decision: 'REJECT',
      verificationNote: 'Breaker still trips when geyser is switched on.',
      reopenReason: 'Breaker still trips when geyser load is applied.',
    },
  });
  assert.equal(rejectRes.status, 200);

  // Staff resumes work on reopened ticket
  const resumeRes = await apiRequest(`/api/complaints/${complaintId}/resume`, {
    method: 'PATCH',
    token: staffToken,
  });
  assert.equal(resumeRes.status, 200);

  const reopenedComplaint = await Complaint.findById(complaintId);
  assert.equal(reopenedComplaint.status, 'IN_PROGRESS');
  assert.equal(reopenedComplaint.slaStatus, 'ACTIVE');

  // Verify multiple cycles exist in history
  const cycles = await ComplaintSlaCycle.find({ complaintId }).sort({ cycleNumber: 1 });
  assert.ok(cycles.length >= 2, 'Should preserve historical cycles upon reopen');
});

test('20. Manual reassignment initiates a new SLA cycle with updated deadline', async () => {
  // Create another staff user
  const staff2 = await User.create({
    name: 'Backup Plumber Staff',
    email: `backup.plumber.${Date.now()}@bbdu.ac.in`,
    passwordHash: staffUser.passwordHash,
    role: 'HOSTEL_STAFF',
    phone: '9876543299',
    departmentId: testDept._id,
    isActive: true,
  });

  const subRes = await apiRequest('/api/complaints', {
    method: 'POST',
    token: studentToken,
    body: {
      title: 'Broken window latch in room',
      category: 'ELECTRICAL',
      issueType: 'ELECTRICITY_FAILURE',
      priority: 'LOW',
      description: 'Window wall socket sparking intermittently.',
    },
  });
  assert.equal(subRes.status, 201);
  const complaintId = subRes.data.data._id;

  await apiRequest(`/api/complaints/${complaintId}/triage`, {
    method: 'PATCH',
    token: wardenToken,
    body: { triageNote: 'Triaged electrical socket repair' },
  });

  await apiRequest(`/api/complaints/${complaintId}/assign`, {
    method: 'PATCH',
    token: wardenToken,
    body: {
      departmentId: testDept._id.toString(),
      assignedTo: staffUser._id.toString(),
      reason: 'Initial socket assignment',
    },
  });

  // Reassign to staff2
  const reassignRes = await apiRequest(`/api/complaints/${complaintId}/reassign`, {
    method: 'PATCH',
    token: wardenToken,
    body: {
      assignedTo: staff2._id.toString(),
      reason: 'Staff 1 occupied on emergency; reassigning to Staff 2.',
    },
  });
  assert.equal(reassignRes.status, 200);

  const reassignedComp = await Complaint.findById(complaintId);
  assert.equal(String(reassignedComp.assignedTo), String(staff2._id));
  assert.equal(reassignedComp.slaStatus, 'ACTIVE');

  const cycles = await ComplaintSlaCycle.find({ complaintId }).sort({ cycleNumber: 1 });
  assert.ok(cycles.length >= 2, 'Should create new SLA cycle on reassignment');
  assert.equal(cycles[0].status, 'CANCELLED');
  assert.equal(cycles[1].status, 'ACTIVE');
});


