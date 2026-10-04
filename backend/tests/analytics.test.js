import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_for_suite_1234567890abcdef';
process.env.JWT_EXPIRES_IN = '1h';

const baseUri = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/bbdu_hosteller_test';
const TEST_URI = baseUri.replace(/\/([^/?]+)(\?.*)?$/, '/$1_analytics$2');

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
} = await import('../src/models/index.js');
const { hashPassword } = await import('../src/utils/password.js');
const { signToken } = await import('../src/utils/jwt.js');

let server;
let baseUrl;

let adminToken;
let wardenToken;
let warden2Token;
let staffToken;
let studentToken;
let authorityToken;

let hostel1;
let hostel2;
let testBlock1;
let testFloor1;
let testRoom1;
let testDeptElec;
let testDeptPlumb;

let adminUser;
let wardenUser1;
let wardenUser2;
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
  ].map((m) => m.syncIndexes()));

  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });

  const pw = await hashPassword('Password@123');

  // Create 2 hostels
  hostel1 = await Hostel.create({
    name: 'Aryabhatta Hostel',
    code: 'ARYA-01',
    type: 'BOYS',
    address: 'BBDU Campus East',
  });

  hostel2 = await Hostel.create({
    name: 'Gargi Girls Hostel',
    code: 'GARG-01',
    type: 'GIRLS',
    address: 'BBDU Campus West',
  });

  testBlock1 = await Block.create({
    name: 'Block A',
    code: 'A',
    hostelId: hostel1._id,
  });

  testFloor1 = await Floor.create({
    floorNumber: 1,
    name: '1st Floor',
    hostelId: hostel1._id,
    blockId: testBlock1._id,
  });

  testRoom1 = await Room.create({
    roomNumber: '101',
    hostelId: hostel1._id,
    blockId: testBlock1._id,
    floorId: testFloor1._id,
    capacity: 2,
    roomType: 'DOUBLE',
  });

  testDeptElec = await Department.create({
    name: 'Electrical Dept',
    code: 'ELEC',
    type: 'MAINTENANCE',
  });

  testDeptPlumb = await Department.create({
    name: 'Plumbing Dept',
    code: 'PLUMB',
    type: 'MAINTENANCE',
  });

  // Create Users
  adminUser = await User.create({
    name: 'Admin Analytics',
    email: 'admin_analytics@bbdu.ac.in',
    passwordHash: pw,
    role: 'SUPER_ADMIN',
  });
  adminToken = signToken({ userId: adminUser._id, role: adminUser.role });

  authorityUser = await User.create({
    name: 'Dean Authority',
    email: 'authority_analytics@bbdu.ac.in',
    passwordHash: pw,
    role: 'AUTHORITY',
  });
  authorityToken = signToken({ userId: authorityUser._id, role: authorityUser.role });

  wardenUser1 = await User.create({
    name: 'Warden Aryabhatta',
    email: 'warden_arya@bbdu.ac.in',
    passwordHash: pw,
    role: 'WARDEN',
    hostelId: hostel1._id,
  });
  wardenToken = signToken({ userId: wardenUser1._id, role: wardenUser1.role });

  wardenUser2 = await User.create({
    name: 'Warden Gargi',
    email: 'warden_gargi@bbdu.ac.in',
    passwordHash: pw,
    role: 'WARDEN',
    hostelId: hostel2._id,
  });
  warden2Token = signToken({ userId: wardenUser2._id, role: wardenUser2.role });

  staffUser = await User.create({
    name: 'Electrician Ramesh',
    email: 'ramesh_elec@bbdu.ac.in',
    passwordHash: pw,
    role: 'HOSTEL_STAFF',
    departmentId: testDeptElec._id,
    hostelId: hostel1._id,
  });
  staffToken = signToken({ userId: staffUser._id, role: staffUser.role });

  studentUser = await User.create({
    name: 'Student Rohan',
    email: 'rohan_stu@bbdu.ac.in',
    passwordHash: pw,
    role: 'STUDENT',
    studentId: 'STU-ANA-001',
    hostelId: hostel1._id,
    blockId: testBlock1._id,
    floorId: testFloor1._id,
    roomId: testRoom1._id,
  });
  studentToken = signToken({ userId: studentUser._id, role: studentUser.role });

  // Seed sample complaints
  const now = new Date();
  const twoHoursAgo = new Date(now.getTime() - 2 * 3600 * 1000);
  const oneHourAgo = new Date(now.getTime() - 1 * 3600 * 1000);
  const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 3600 * 1000);
  const sixDaysAgo = new Date(now.getTime() - 6 * 24 * 3600 * 1000);

  // Complaint 1: In Aryabhatta, Resolved, on-time
  const c1 = await Complaint.create({
    complaintId: 'CMP-ANA-001',
    title: 'Ceiling Fan Not Working',
    description: 'The ceiling fan is making loud noise and not spinning.',
    category: 'ELECTRICAL',
    issueType: 'FAN_NOT_WORKING',
    priority: 'MEDIUM',
    status: 'RESOLVED',
    studentId: studentUser._id,
    hostelId: hostel1._id,
    blockId: testBlock1._id,
    floorId: testFloor1._id,
    roomId: testRoom1._id,
    departmentId: testDeptElec._id,
    assignedTo: staffUser._id,
    submittedAt: sixDaysAgo,
    assignedAt: fiveDaysAgo,
    acknowledgedAt: fiveDaysAgo,
    startedAt: fiveDaysAgo,
    resolvedAt: fiveDaysAgo,
    slaStatus: 'COMPLETED',
    createdAt: sixDaysAgo,
  });

  // Complaint 2: In Aryabhatta, In Progress, SLA Breached, Escalated to Warden (Level 1)
  const c2 = await Complaint.create({
    complaintId: 'CMP-ANA-002',
    title: 'Switchboard sparking',
    description: 'Switchboard is sparking near desk 2.',
    category: 'ELECTRICAL',
    issueType: 'SWITCH_SOCKET_ISSUE',
    priority: 'CRITICAL',
    status: 'IN_PROGRESS',
    studentId: studentUser._id,
    hostelId: hostel1._id,
    blockId: testBlock1._id,
    floorId: testFloor1._id,
    roomId: testRoom1._id,
    departmentId: testDeptElec._id,
    assignedTo: staffUser._id,
    submittedAt: twoHoursAgo,
    assignedAt: twoHoursAgo,
    acknowledgedAt: oneHourAgo,
    startedAt: oneHourAgo,
    slaStatus: 'BREACHED',
    slaBreachedAt: oneHourAgo,
    currentEscalationLevel: 1,
    createdAt: twoHoursAgo,
  });

  // Create SLA cycle & escalation for c2
  await ComplaintSlaCycle.create({
    complaintId: c2._id,
    cycleNumber: 1,
    escalationLevel: 0,
    startedAt: twoHoursAgo,
    dueAt: oneHourAgo,
    breachedAt: oneHourAgo,
    status: 'BREACHED',
  });

  await ComplaintEscalation.create({
    complaintId: c2._id,
    fromUserId: staffUser._id,
    toUserId: wardenUser1._id,
    fromRole: 'HOSTEL_STAFF',
    toRole: 'WARDEN',
    escalationLevel: 1,
    reason: 'SLA breached at staff level',
    triggeredBy: 'SYSTEM',
    triggeredAt: oneHourAgo,
    slaBreachedAt: oneHourAgo,
  });

  // Complaint 3: In Gargi, SUBMITTED (Open), Plumb dept
  await Complaint.create({
    complaintId: 'CMP-ANA-003',
    title: 'Tap leaking continuously',
    description: 'Water tap is leaking in the washroom.',
    category: 'PLUMBING',
    issueType: 'WATER_LEAKAGE',
    priority: 'LOW',
    status: 'SUBMITTED',
    studentId: studentUser._id,
    hostelId: hostel2._id,
    blockId: testBlock1._id,
    floorId: testFloor1._id,
    roomId: testRoom1._id,
    departmentId: testDeptPlumb._id,
    submittedAt: oneHourAgo,
    slaStatus: 'ACTIVE',
    slaDueAt: new Date(now.getTime() + 24 * 3600 * 1000),
    createdAt: oneHourAgo,
  });
});

after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await disconnectDB();
});

test('1. Student accessing operational analytics receives 403 Forbidden', async () => {
  const res = await fetch(`${baseUrl}/api/analytics/overview`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert.equal(res.status, 403);
  const body = await res.json();
  assert.equal(body.success, false);
});

test('2. Super Admin retrieves campus-wide Overview KPIs', async () => {
  const res = await fetch(`${baseUrl}/api/analytics/overview?range=all`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(res.status, 200);
  const { data } = await res.json();

  assert.equal(data.totalComplaints, 3);
  assert.equal(data.openComplaints, 2); // c2 (IN_PROGRESS), c3 (SUBMITTED)
  assert.equal(data.inProgressComplaints, 1);
  assert.equal(data.resolvedComplaints, 1);
  assert.equal(data.escalatedComplaints, 1); // c2
  assert.equal(data.slaBreachedComplaints, 1); // c2
  assert.ok(data.slaComplianceRate >= 66 && data.slaComplianceRate <= 67);
  assert.ok(typeof data.avgResolutionTimeHours === 'number');
  assert.ok(typeof data.avgFirstResponseTimeHours === 'number');
});

test('3. Authority user retrieves campus-wide Overview KPIs', async () => {
  const res = await fetch(`${baseUrl}/api/analytics/overview?range=all`, {
    headers: { Authorization: `Bearer ${authorityToken}` },
  });
  assert.equal(res.status, 200);
  const { data } = await res.json();
  assert.equal(data.totalComplaints, 3);
});

test('4. Warden is strictly scoped to their assigned hostel', async () => {
  // Warden 1 (Aryabhatta) should only see complaints from Aryabhatta (2 complaints: c1 and c2)
  const res1 = await fetch(`${baseUrl}/api/analytics/overview?range=all`, {
    headers: { Authorization: `Bearer ${wardenToken}` },
  });
  assert.equal(res1.status, 200);
  const body1 = await res1.json();
  assert.equal(body1.data.totalComplaints, 2);

  // Warden 2 (Gargi) should only see complaints from Gargi (1 complaint: c3)
  const res2 = await fetch(`${baseUrl}/api/analytics/overview?range=all`, {
    headers: { Authorization: `Bearer ${warden2Token}` },
  });
  assert.equal(res2.status, 200);
  const body2 = await res2.json();
  assert.equal(body2.data.totalComplaints, 1);
  assert.equal(body2.data.openComplaints, 1);
  assert.equal(body2.data.resolvedComplaints, 0);
});

test('5. Time-series Complaint Trends returns proper date groupings', async () => {
  const res = await fetch(`${baseUrl}/api/analytics/trends?range=all&groupBy=day`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(res.status, 200);
  const { data } = await res.json();
  assert.ok(Array.isArray(data.trends));
  assert.ok(data.trends.length >= 1);
  const first = data.trends[0];
  assert.ok('date' in first);
  assert.ok('submitted' in first);
  assert.ok('resolved' in first);
  assert.ok('breached' in first);
});

test('6. Status Distribution returns all complaint statuses with percentages', async () => {
  const res = await fetch(`${baseUrl}/api/analytics/status-distribution?range=all`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(res.status, 200);
  const { data } = await res.json();
  assert.equal(data.total, 3);
  assert.ok(Array.isArray(data.distribution));
  assert.ok(data.distribution.some((d) => d.status === 'RESOLVED' && d.count === 1));
  assert.ok(data.distribution.some((d) => d.status === 'IN_PROGRESS' && d.count === 1));
  assert.ok(data.distribution.some((d) => d.status === 'SUBMITTED' && d.count === 1));
});

test('7. Category Analytics returns metrics per complaint category', async () => {
  const res = await fetch(`${baseUrl}/api/analytics/categories?range=all`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(res.status, 200);
  const { data } = await res.json();
  assert.equal(data.total, 3);
  assert.ok(Array.isArray(data.categories));
  const elec = data.categories.find((c) => c.category === 'ELECTRICAL');
  assert.ok(elec);
  assert.equal(elec.count, 2);
  assert.equal(elec.breachedCount, 1);
});

test('8. Priority Analytics returns CRITICAL, HIGH, MEDIUM, LOW metrics', async () => {
  const res = await fetch(`${baseUrl}/api/analytics/priorities?range=all`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(res.status, 200);
  const { data } = await res.json();
  assert.equal(data.total, 3);
  assert.ok(Array.isArray(data.priorities));
  const crit = data.priorities.find((p) => p.priority === 'CRITICAL');
  assert.ok(crit);
  assert.equal(crit.count, 1);
  assert.equal(crit.breachedCount, 1);
});

test('9. Department Performance computes metrics per department', async () => {
  const res = await fetch(`${baseUrl}/api/analytics/departments?range=all`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(res.status, 200);
  const { data } = await res.json();
  assert.ok(Array.isArray(data.departments));
  const elecDept = data.departments.find((d) => d.code === 'ELEC');
  assert.ok(elecDept);
  assert.equal(elecDept.total, 2);
  assert.equal(elecDept.resolved, 1);
  assert.equal(elecDept.breached, 1);
});

test('10. Hostel Performance computes metrics per hostel', async () => {
  const res = await fetch(`${baseUrl}/api/analytics/hostels?range=all`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(res.status, 200);
  const { data } = await res.json();
  assert.ok(Array.isArray(data.hostels));
  const arya = data.hostels.find((h) => h.code === 'ARYA-01');
  assert.ok(arya);
  assert.equal(arya.total, 2);
  assert.equal(arya.resolved, 1);
  assert.equal(arya.breached, 1);
  assert.equal(arya.escalated, 1);
});

test('11. SLA Performance endpoint returns cycle details and breach compliance', async () => {
  const res = await fetch(`${baseUrl}/api/analytics/sla?range=all`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(res.status, 200);
  const { data } = await res.json();
  assert.equal(data.totalComplaints, 3);
  assert.equal(data.slaBreachedComplaints, 1);
  assert.equal(data.totalCycles, 1);
  assert.equal(data.breachedCycles, 1);
});

test('12. Escalation Analytics returns levels and recent logs', async () => {
  const res = await fetch(`${baseUrl}/api/analytics/escalations?range=all`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(res.status, 200);
  const { data } = await res.json();
  assert.equal(data.totalEscalations, 1);
  assert.ok(Array.isArray(data.byLevel));
  assert.ok(data.byLevel.some((l) => l.level === 1 && l.count === 1));
  assert.ok(data.recentEscalations.length >= 1);
  assert.equal(data.recentEscalations[0].fromRole, 'HOSTEL_STAFF');
  assert.equal(data.recentEscalations[0].toRole, 'WARDEN');
});

test('13. Staff Workload returns assignment and resolution rates', async () => {
  const res = await fetch(`${baseUrl}/api/analytics/workload?range=all`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(res.status, 200);
  const { data } = await res.json();
  assert.ok(Array.isArray(data.workload));
  const ramesh = data.workload.find((w) => w.email === 'ramesh_elec@bbdu.ac.in');
  assert.ok(ramesh);
  assert.equal(ramesh.totalAssigned, 2);
  assert.equal(ramesh.resolved, 1);
  assert.equal(ramesh.active, 1);
});

test('14. CSV Export returns proper CSV data and headers', async () => {
  const res = await fetch(`${baseUrl}/api/analytics/export?type=complaints&range=all`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(res.status, 200);
  assert.ok(res.headers.get('content-type').includes('text/csv'));
  const csvText = await res.text();
  assert.ok(csvText.includes('Complaint ID'));
  assert.ok(csvText.includes('CMP-ANA-001'));
  assert.ok(csvText.includes('CMP-ANA-002'));
});

test('15. CSV Export for departments and hostels works seamlessly', async () => {
  const deptRes = await fetch(`${baseUrl}/api/analytics/export?type=departments&range=all`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(deptRes.status, 200);
  const deptCsv = await deptRes.text();
  assert.ok(deptCsv.includes('Department Name'));
  assert.ok(deptCsv.includes('Electrical Dept'));

  const hostelRes = await fetch(`${baseUrl}/api/analytics/export?type=hostels&range=all`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(hostelRes.status, 200);
  const hostelCsv = await hostelRes.text();
  assert.ok(hostelCsv.includes('Hostel Name'));
  assert.ok(hostelCsv.includes('Aryabhatta Hostel'));
});
