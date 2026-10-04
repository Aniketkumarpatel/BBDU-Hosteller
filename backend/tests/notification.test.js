import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_for_notification_suite_12345';
process.env.JWT_EXPIRES_IN = '1h';

const baseUri = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/bbdu_hosteller_test';
const TEST_URI = baseUri.replace(/\/([^/?]+)(\?.*)?$/, '/$1_notification$2');

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
  Notification,
} = await import('../src/models/index.js');
const { hashPassword } = await import('../src/utils/password.js');
const { signToken } = await import('../src/utils/jwt.js');
const {
  createNotification,
  getUnreadCount,
} = await import('../src/services/notification.service.js');
const { NOTIFICATION_TYPES } = await import('../src/constants/notification.constants.js');

let server;
let baseUrl;

let studentToken;
let studentUser;
let wardenToken;
let wardenUser;
let staffToken;
let staffUser;
let otherStudentToken;
let otherStudentUser;

let testHostel;
let testBlock;
let testFloor;
let testRoom;
let testDept;

before(async () => {
  await connectDB(TEST_URI);
  await mongoose.connection.dropDatabase();

  const passwordHash = await hashPassword('TestPassword123!');

  testHostel = await Hostel.create({
    name: 'Tagore Notification Boys Hostel',
    code: 'TNBH',
    type: 'BOYS',
    totalCapacity: 100,
    currentOccupancy: 0,
    isActive: true,
  });

  testBlock = await Block.create({
    name: 'Block N',
    code: 'BN',
    hostelId: testHostel._id,
    isActive: true,
  });

  testFloor = await Floor.create({
    floorNumber: 1,
    name: 'First Floor',
    hostelId: testHostel._id,
    blockId: testBlock._id,
    isActive: true,
  });

  testRoom = await Room.create({
    roomNumber: 'N-101',
    hostelId: testHostel._id,
    blockId: testBlock._id,
    floorId: testFloor._id,
    capacity: 2,
    currentOccupancy: 1,
    roomType: 'DOUBLE',
    isActive: true,
  });

  testDept = await Department.create({
    name: 'Electrical Engineering',
    code: 'ELEC',
    description: 'Electrical and wiring repairs',
    isActive: true,
  });

  studentUser = await User.create({
    name: 'Notif Student One',
    email: 'notif.student1@bbdu.ac.in',
    passwordHash,
    role: 'STUDENT',
    studentId: 'BBDU2026NOTIF01',
    phone: '9876543210',
    hostelId: testHostel._id,
    blockId: testBlock._id,
    floorId: testFloor._id,
    roomId: testRoom._id,
    isActive: true,
  });
  studentToken = signToken({ userId: studentUser._id.toString(), role: studentUser.role });

  otherStudentUser = await User.create({
    name: 'Other Student Two',
    email: 'notif.student2@bbdu.ac.in',
    passwordHash,
    role: 'STUDENT',
    studentId: 'BBDU2026NOTIF02',
    phone: '9876543211',
    hostelId: testHostel._id,
    blockId: testBlock._id,
    floorId: testFloor._id,
    roomId: testRoom._id,
    isActive: true,
  });
  otherStudentToken = signToken({ userId: otherStudentUser._id.toString(), role: otherStudentUser.role });

  wardenUser = await User.create({
    name: 'Notif Hostel Warden',
    email: 'notif.warden@bbdu.ac.in',
    passwordHash,
    role: 'WARDEN',
    phone: '9876543212',
    hostelId: testHostel._id,
    isActive: true,
  });
  wardenToken = signToken({ userId: wardenUser._id.toString(), role: wardenUser.role });

  staffUser = await User.create({
    name: 'Notif Electrician Staff',
    email: 'notif.electrician@bbdu.ac.in',
    passwordHash,
    role: 'HOSTEL_STAFF',
    phone: '9876543213',
    departmentId: testDept._id,
    isActive: true,
  });
  staffToken = signToken({ userId: staffUser._id.toString(), role: staffUser.role });

  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}/api`;
      resolve();
    });
  });
});

after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await mongoose.connection.dropDatabase();
  await disconnectDB();
});

test('1. Notification creation and deduplication guard', async () => {
  const notif1 = await createNotification({
    recipient: studentUser._id,
    type: NOTIFICATION_TYPES.GENERAL_NOTICE,
    title: 'Test Notification',
    message: 'Testing notification creation',
    relatedEntityType: 'GENERAL',
    relatedEntityId: new mongoose.Types.ObjectId(),
  });

  assert.ok(notif1._id, 'Notification should be created with an ID');
  assert.equal(notif1.isRead, false);

  // Attempt creating exact same notification within 10s
  const notif2 = await createNotification({
    recipient: studentUser._id,
    type: NOTIFICATION_TYPES.GENERAL_NOTICE,
    title: 'Test Notification',
    message: 'Testing notification creation',
    relatedEntityType: 'GENERAL',
    relatedEntityId: notif1.relatedEntityId,
  });

  assert.equal(String(notif1._id), String(notif2._id), 'Deduplication should return existing notification within 10s');

  const count = await getUnreadCount(studentUser._id);
  assert.equal(count, 1, 'Unread count should be 1');
});

test('2. GET /api/notifications/unread-count requires authentication', async () => {
  const unauthRes = await fetch(`${baseUrl}/notifications/unread-count`);
  assert.equal(unauthRes.status, 401, 'Should reject unauthenticated request');

  const authRes = await fetch(`${baseUrl}/notifications/unread-count`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert.equal(authRes.status, 200);
  const data = await authRes.json();
  assert.equal(data.success, true);
  assert.equal(typeof data.data.unreadCount, 'number');
});

test('3. GET /api/notifications returns user specific notifications', async () => {
  const res = await fetch(`${baseUrl}/notifications?limit=10`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, true);
  assert.ok(Array.isArray(body.data.notifications));
  assert.ok(body.data.notifications.length >= 1);
  assert.equal(body.data.notifications[0].recipient.toString(), studentUser._id.toString());

  // Other student should not see studentUser's notifications
  const otherRes = await fetch(`${baseUrl}/notifications`, {
    headers: { Authorization: `Bearer ${otherStudentToken}` },
  });
  assert.equal(otherRes.status, 200);
  const otherBody = await otherRes.json();
  assert.equal(otherBody.data.notifications.length, 0, 'Other student should have 0 notifications');
});

test('4. PATCH /api/notifications/:id/read marks notification as read with RBAC ownership check', async () => {
  const unreadNotif = await createNotification({
    recipient: studentUser._id,
    type: NOTIFICATION_TYPES.COMPLAINT_STATUS_CHANGED,
    title: 'Status Update',
    message: 'Complaint was acknowledged',
  });

  // Other user attempts to mark it read -> 403 Forbidden
  const forbiddenRes = await fetch(`${baseUrl}/notifications/${unreadNotif._id}/read`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${otherStudentToken}` },
  });
  assert.equal(forbiddenRes.status, 403, 'Should reject modifying another user notification');

  // Owner marks it read -> 200 OK
  const okRes = await fetch(`${baseUrl}/notifications/${unreadNotif._id}/read`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert.equal(okRes.status, 200);
  const okBody = await okRes.json();
  assert.equal(okBody.success, true);
  assert.equal(okBody.data.isRead, true);
  assert.ok(okBody.data.readAt);
});

test('5. PATCH /api/notifications/read-all marks all unread as read', async () => {
  // Create 2 unread notifications for student
  await createNotification({
    recipient: studentUser._id,
    type: NOTIFICATION_TYPES.COMPLAINT_SLA_WARNING,
    title: 'Notice 1',
    message: 'Notice msg 1',
  });
  await createNotification({
    recipient: studentUser._id,
    type: NOTIFICATION_TYPES.COMPLAINT_ESCALATED,
    title: 'Notice 2',
    message: 'Notice msg 2',
  });

  const res = await fetch(`${baseUrl}/notifications/read-all`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, true);
  assert.ok(body.data.updatedCount >= 2);

  const countRes = await fetch(`${baseUrl}/notifications/unread-count`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  const countBody = await countRes.json();
  assert.equal(countBody.data.unreadCount, 0, 'Unread count should now be 0');
});

test('6. DELETE /api/notifications/:id deletes notification', async () => {
  const notif = await createNotification({
    recipient: studentUser._id,
    type: NOTIFICATION_TYPES.GENERAL_NOTICE,
    title: 'Deletable Notice',
    message: 'Will be deleted',
  });

  // Cross-user attempt
  const forbiddenRes = await fetch(`${baseUrl}/notifications/${notif._id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${otherStudentToken}` },
  });
  assert.equal(forbiddenRes.status, 403);

  // Owner deletes
  const okRes = await fetch(`${baseUrl}/notifications/${notif._id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert.equal(okRes.status, 200);

  const check = await Notification.findById(notif._id);
  assert.equal(check, null, 'Document should be deleted');
});

test('7. End-to-end Complaint Lifecycle Triggers In-App Notifications', async () => {
  // Clear notifications for clean assertions
  await Notification.deleteMany({});

  // 1. Submit complaint
  const submitRes = await fetch(`${baseUrl}/complaints`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${studentToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: 'Ceiling fan making screeching noise',
      description: 'The fan in room N-101 has a faulty motor bearing.',
      category: 'ELECTRICAL',
      issueType: 'FAN_NOT_WORKING',
      priority: 'HIGH',
    }),
  });
  assert.equal(submitRes.status, 201);
  const submitBody = await submitRes.json();
  const complaint = submitBody.data;

  // Allow asynchronous notification dispatch to persist
  await new Promise((r) => setTimeout(r, 200));

  // Verify Student received COMPLAINT_SUBMITTED
  const studentNotifs = await Notification.find({
    recipient: studentUser._id,
    type: NOTIFICATION_TYPES.COMPLAINT_SUBMITTED,
  });
  assert.equal(studentNotifs.length, 1, 'Student should receive COMPLAINT_SUBMITTED notification');
  assert.ok(studentNotifs[0].title.includes('Submitted'));

  // Verify Warden received COMPLAINT_SUBMITTED
  const wardenNotifs = await Notification.find({
    recipient: wardenUser._id,
    type: NOTIFICATION_TYPES.COMPLAINT_SUBMITTED,
  });
  assert.equal(wardenNotifs.length, 1, 'Warden should receive COMPLAINT_SUBMITTED notification for hostel');

  // 2. Warden triages complaint
  const triageRes = await fetch(`${baseUrl}/complaints/${complaint._id}/triage`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${wardenToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      triageNote: 'Triaged and verified electrical motor fault.',
    }),
  });
  assert.equal(triageRes.status, 200);

  // 3. Warden assigns complaint to staff
  const assignRes = await fetch(`${baseUrl}/complaints/${complaint._id}/assign`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${wardenToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      assignedTo: staffUser._id.toString(),
      reason: 'Assigning to chief electrician for capacitor and bearing check.',
    }),
  });
  assert.equal(assignRes.status, 200);

  await new Promise((r) => setTimeout(r, 200));

  // Verify staff received COMPLAINT_ASSIGNED
  const staffNotifs = await Notification.find({
    recipient: staffUser._id,
    type: NOTIFICATION_TYPES.COMPLAINT_ASSIGNED,
  });
  assert.equal(staffNotifs.length, 1, 'Assigned staff should receive COMPLAINT_ASSIGNED notification');

  // 4. Staff acknowledges complaint
  const ackRes = await fetch(`${baseUrl}/complaints/${complaint._id}/acknowledge`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${staffToken}` },
  });
  assert.equal(ackRes.status, 200);

  await new Promise((r) => setTimeout(r, 200));

  // Verify student received COMPLAINT_ACKNOWLEDGED
  const ackNotifs = await Notification.find({
    recipient: studentUser._id,
    type: NOTIFICATION_TYPES.COMPLAINT_ACKNOWLEDGED,
  });
  assert.equal(ackNotifs.length, 1, 'Student should receive COMPLAINT_ACKNOWLEDGED notification');

  // 5. Staff starts work
  const startRes = await fetch(`${baseUrl}/complaints/${complaint._id}/start`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${staffToken}` },
  });
  assert.equal(startRes.status, 200);

  // 6. Staff resolves complaint
  const resolveRes = await fetch(`${baseUrl}/complaints/${complaint._id}/resolve`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${staffToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      resolutionNote: 'Bearing replaced and motor lubricated. Tested running at full speed.',
    }),
  });
  assert.equal(resolveRes.status, 200);

  await new Promise((r) => setTimeout(r, 200));

  // Verify student received COMPLAINT_RESOLVED
  const resolveNotifs = await Notification.find({
    recipient: studentUser._id,
    type: NOTIFICATION_TYPES.COMPLAINT_RESOLVED,
  });
  assert.equal(resolveNotifs.length, 1, 'Student should receive COMPLAINT_RESOLVED notification');

  // 7. Student rejects and reopens complaint
  const reopenRes = await fetch(`${baseUrl}/complaints/${complaint._id}/verify`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${studentToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      decision: 'REJECT',
      verificationNote: 'Fan still vibrates violently at speed 4 and 5.',
      reopenReason: 'Vibration and noise issue still persists at high speed.',
    }),
  });
  assert.equal(reopenRes.status, 200);

  await new Promise((r) => setTimeout(r, 200));

  // Verify staff and warden received COMPLAINT_REOPENED
  const staffReopenNotifs = await Notification.find({
    recipient: staffUser._id,
    type: NOTIFICATION_TYPES.COMPLAINT_REOPENED,
  });
  assert.equal(staffReopenNotifs.length, 1, 'Assigned staff should receive COMPLAINT_REOPENED notification');

  const wardenReopenNotifs = await Notification.find({
    recipient: wardenUser._id,
    type: NOTIFICATION_TYPES.COMPLAINT_REOPENED,
  });
  assert.equal(wardenReopenNotifs.length, 1, 'Warden should receive COMPLAINT_REOPENED notification');
});
