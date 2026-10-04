import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_for_suite_1234567890abcdef';
process.env.JWT_EXPIRES_IN = '1h';

const baseUri = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/bbdu_hosteller_test';
const TEST_URI = baseUri.replace(/\/([^/?]+)(\?.*)?$/, '/$1_student_services$2');

const { connectDB, disconnectDB } = await import('../src/config/db.js');
const { default: app } = await import('../src/app.js');
const {
  User,
  Hostel,
  Block,
  Floor,
  Room,
  Notice,
  ServiceRequest,
  HostelContact,
  StudentFeedback,
  Notification,
} = await import('../src/models/index.js');
const { hashPassword } = await import('../src/utils/password.js');
const { signToken } = await import('../src/utils/jwt.js');
const { processStudentServicesLifecycleJobs } = await import('../src/services/studentServices.service.js');

let server;
let baseUrl;

let adminToken;
let wardenAToken;
let wardenBToken;
let staffToken;
let studentAToken;
let studentBToken;

let adminUser;
let wardenAUser;
let wardenBUser;
let staffUser;
let studentAUser;
let studentBUser;

let hostelA;
let hostelB;
let blockA;
let floorA;
let roomA;

before(async () => {
  await connectDB(TEST_URI);
  await mongoose.connection.dropDatabase();

  server = app.listen(0);
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}/api`;

  const pwHash = await hashPassword('Password123!');

  // Seed Hostels
  hostelA = await Hostel.create({
    name: 'Tagore Hostel A',
    code: 'THA',
    type: 'BOYS',
    address: 'Main Rd, Lucknow, UP 226028',
  });

  hostelB = await Hostel.create({
    name: 'Sarojini Hostel B',
    code: 'SHB',
    type: 'GIRLS',
    address: 'Campus North, Lucknow, UP 226028',
  });

  blockA = await Block.create({
    name: 'Block Alpha',
    code: 'BLK-A',
    hostelId: hostelA._id,
  });

  floorA = await Floor.create({
    floorNumber: 1,
    name: 'First Floor',
    hostelId: hostelA._id,
    blockId: blockA._id,
  });

  roomA = await Room.create({
    roomNumber: '101',
    hostelId: hostelA._id,
    blockId: blockA._id,
    floorId: floorA._id,
    capacity: 2,
    roomType: 'DOUBLE',
    baseRent: 5000,
  });

  // Seed Users
  adminUser = await User.create({
    name: 'Super Administrator',
    email: 'admin.studentservices@bbdu.ac.in',
    passwordHash: pwHash,
    role: 'SUPER_ADMIN',
  });
  adminToken = signToken({ userId: adminUser._id, role: adminUser.role });

  wardenAUser = await User.create({
    name: 'Warden Tagore A',
    email: 'warden.a.studentservices@bbdu.ac.in',
    passwordHash: pwHash,
    role: 'WARDEN',
    hostelId: hostelA._id,
  });
  wardenAToken = signToken({ userId: wardenAUser._id, role: wardenAUser.role, hostelId: hostelA._id });

  wardenBUser = await User.create({
    name: 'Warden Sarojini B',
    email: 'warden.b.studentservices@bbdu.ac.in',
    passwordHash: pwHash,
    role: 'WARDEN',
    hostelId: hostelB._id,
  });
  wardenBToken = signToken({ userId: wardenBUser._id, role: wardenBUser.role, hostelId: hostelB._id });

  staffUser = await User.create({
    name: 'Hostel Maintenance Staff',
    email: 'staff.studentservices@bbdu.ac.in',
    passwordHash: pwHash,
    role: 'HOSTEL_STAFF',
    hostelId: hostelA._id,
    employeeId: 'EMP-STF-01',
  });
  staffToken = signToken({ userId: staffUser._id, role: staffUser.role, hostelId: hostelA._id });

  studentAUser = await User.create({
    name: 'Rahul Sharma',
    email: 'rahul.studentservices@bbdu.ac.in',
    passwordHash: pwHash,
    role: 'STUDENT',
    hostelId: hostelA._id,
    blockId: blockA._id,
    floorId: floorA._id,
    roomId: roomA._id,
    studentId: 'BBDU2026001',
  });
  studentAToken = signToken({
    userId: studentAUser._id,
    role: studentAUser.role,
    hostelId: hostelA._id,
    blockId: blockA._id,
    floorId: floorA._id,
    roomId: roomA._id,
  });

  studentBUser = await User.create({
    name: 'Ananya Verma',
    email: 'ananya.studentservices@bbdu.ac.in',
    passwordHash: pwHash,
    role: 'STUDENT',
    hostelId: hostelB._id,
    studentId: 'BBDU2026002',
  });
  studentBToken = signToken({ userId: studentBUser._id, role: studentBUser.role, hostelId: hostelB._id });
});

after(async () => {
  if (server) await new Promise((r) => server.close(r));
  await mongoose.connection.dropDatabase();
  await disconnectDB();
});

// ============================================================================
// 1. DIGITAL NOTICES TESTS
// ============================================================================

test('POST /api/student-services/notices - Warden can create notice for own hostel', async () => {
  const res = await fetch(`${baseUrl}/student-services/notices`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${wardenAToken}`,
    },
    body: JSON.stringify({
      title: 'Water Supply Maintenance Schedule',
      description: 'Water supply will be suspended tomorrow from 10:00 AM to 12:00 PM for pipeline repairs.',
      category: 'MAINTENANCE',
      priority: 'HIGH',
      targetAudience: 'HOSTEL',
      hostelId: String(hostelA._id),
      requiresAcknowledgement: true,
    }),
  });

  const body = await res.json();
  assert.equal(res.status, 201, `Failed to create notice: ${JSON.stringify(body)}`);
  assert.equal(body.success, true);
  assert.ok(body.data.noticeId.startsWith('NOT-'));
  assert.equal(body.data.title, 'Water Supply Maintenance Schedule');
  assert.equal(body.data.requiresAcknowledgement, true);
});

test('POST /api/student-services/notices - Warden cannot create notice for another hostel (RBAC/Isolation)', async () => {
  const res = await fetch(`${baseUrl}/student-services/notices`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${wardenAToken}`,
    },
    body: JSON.stringify({
      title: 'Unauthorized Notice for Hostel B',
      description: 'This notice should be rejected because Warden A does not manage Hostel B.',
      category: 'GENERAL',
      hostelId: String(hostelB._id),
    }),
  });

  const body = await res.json();
  assert.equal(res.status, 403);
  assert.equal(body.success, false);
});

test('GET /api/student-services/notices - Student only sees notices for their hostel and campus-wide', async () => {
  // Create campus wide notice by Super Admin
  await fetch(`${baseUrl}/student-services/notices`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      title: 'Campus Annual Fest Announcement',
      description: 'The annual fest UTKARSH 2026 dates are released.',
      category: 'EVENT',
      targetAudience: 'ALL',
      priority: 'NORMAL',
    }),
  });

  // Create notice for Hostel B by Warden B
  await fetch(`${baseUrl}/student-services/notices`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${wardenBToken}`,
    },
    body: JSON.stringify({
      title: 'Hostel B Exclusive Notice',
      description: 'Only for Sarojini Hostel residents.',
      category: 'HOSTEL',
      targetAudience: 'HOSTEL',
      hostelId: String(hostelB._id),
    }),
  });

  // Query as Student A (Tagore Hostel A)
  const resA = await fetch(`${baseUrl}/student-services/notices`, {
    headers: { Authorization: `Bearer ${studentAToken}` },
  });
  const dataA = await resA.json();
  assert.equal(resA.status, 200);
  assert.ok(dataA.data.notices.length >= 2);
  const titlesA = dataA.data.notices.map((n) => n.title);
  assert.ok(titlesA.includes('Water Supply Maintenance Schedule'));
  assert.ok(titlesA.includes('Campus Annual Fest Announcement'));
  assert.ok(!titlesA.includes('Hostel B Exclusive Notice'));

  // Query as Student B (Sarojini Hostel B)
  const resB = await fetch(`${baseUrl}/student-services/notices`, {
    headers: { Authorization: `Bearer ${studentBToken}` },
  });
  const dataB = await resB.json();
  assert.equal(resB.status, 200);
  const titlesB = dataB.data.notices.map((n) => n.title);
  assert.ok(titlesB.includes('Hostel B Exclusive Notice'));
  assert.ok(titlesB.includes('Campus Annual Fest Announcement'));
  assert.ok(!titlesB.includes('Water Supply Maintenance Schedule'));
});

test('POST /api/student-services/notices/:id/acknowledge - Student acknowledges mandatory notice', async () => {
  const listRes = await fetch(`${baseUrl}/student-services/notices`, {
    headers: { Authorization: `Bearer ${studentAToken}` },
  });
  const listData = await listRes.json();
  const noticeToAck = listData.data.notices.find((n) => n.title === 'Water Supply Maintenance Schedule');
  assert.ok(noticeToAck);
  assert.equal(noticeToAck.hasAcknowledged, false);

  // Acknowledge notice
  const ackRes = await fetch(`${baseUrl}/student-services/notices/${noticeToAck._id}/acknowledge`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${studentAToken}` },
  });
  const ackData = await ackRes.json();
  assert.equal(ackRes.status, 200);
  assert.equal(ackData.success, true);
  assert.equal(ackData.data.acknowledgementCount, 1);

  // Re-fetch notice detail and ensure hasAcknowledged and hasViewed are true
  const detailRes = await fetch(`${baseUrl}/student-services/notices/${noticeToAck._id}`, {
    headers: { Authorization: `Bearer ${studentAToken}` },
  });
  const detailData = await detailRes.json();
  assert.equal(detailRes.status, 200);
  assert.equal(detailData.data.hasAcknowledged, true);
  assert.equal(detailData.data.hasViewed, true);
  assert.ok(detailData.data.viewsCount >= 1);
});

// ============================================================================
// 2. STUDENT SERVICE REQUESTS TESTS
// ============================================================================

let createdRequestId;

test('POST /api/student-services/requests - Student submits room change service request', async () => {
  const res = await fetch(`${baseUrl}/student-services/requests`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentAToken}`,
    },
    body: JSON.stringify({
      category: 'ROOM_CHANGE',
      title: 'Room Change Request due to Study Requirements',
      description: 'Requesting relocation to quiet wing on floor 2 due to exam preparations.',
      priority: 'NORMAL',
    }),
  });

  const body = await res.json();
  assert.equal(res.status, 201);
  assert.equal(body.success, true);
  assert.ok(body.data.requestId.startsWith('REQ-'));
  assert.equal(body.data.status, 'SUBMITTED');
  assert.equal(body.data.timeline.length, 1);
  assert.equal(body.data.timeline[0].action, 'SUBMITTED');
  createdRequestId = body.data._id;
});

test('POST /api/student-services/requests/:id/assign - Warden assigns request to staff', async () => {
  const res = await fetch(`${baseUrl}/student-services/requests/${createdRequestId}/assign`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${wardenAToken}`,
    },
    body: JSON.stringify({
      assignedTo: String(staffUser._id),
      notes: 'Please review available rooms in Block Alpha.',
    }),
  });

  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.data.status, 'ASSIGNED');
  assert.equal(String(body.data.assignedTo), String(staffUser._id));
  assert.equal(body.data.timeline.length, 2);
  assert.equal(body.data.timeline[1].action, 'ASSIGNED');
});

test('PATCH /api/student-services/requests/:id/status - Staff resolves request with resolution notes', async () => {
  const res = await fetch(`${baseUrl}/student-services/requests/${createdRequestId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${staffToken}`,
    },
    body: JSON.stringify({
      status: 'RESOLVED',
      resolutionNote: 'Room 204 in Block Alpha assigned. Keys ready at caretaker desk.',
    }),
  });

  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.data.status, 'RESOLVED');
  assert.ok(body.data.resolvedAt);
  assert.equal(body.data.resolutionNote, 'Room 204 in Block Alpha assigned. Keys ready at caretaker desk.');
});

test('POST /api/student-services/requests/:id/verify - Student verifies satisfaction and closes request', async () => {
  const res = await fetch(`${baseUrl}/student-services/requests/${createdRequestId}/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentAToken}`,
    },
    body: JSON.stringify({
      isSatisfied: true,
      feedback: 'Excellent assistance. Relocation completed smoothly.',
    }),
  });

  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.data.status, 'CLOSED');
  assert.ok(body.data.closedAt);
  assert.equal(body.data.studentVerification.isSatisfied, true);
  assert.equal(body.data.studentVerification.feedback, 'Excellent assistance. Relocation completed smoothly.');
});

// ============================================================================
// 3. HOSTEL CONTACT DIRECTORY TESTS
// ============================================================================

test('POST /api/student-services/contacts - Warden adds emergency contact', async () => {
  const res = await fetch(`${baseUrl}/student-services/contacts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${wardenAToken}`,
    },
    body: JSON.stringify({
      title: 'Hostel A Night Security & Medical Desk',
      category: 'EMERGENCY',
      contactPerson: 'Mr. Vikram Singh',
      phoneNumber: '+919876543210',
      altPhoneNumber: '+919876543211',
      availableHours: '24x7',
      location: 'Gate 1 Tagore Hostel',
      isEmergency: true,
    }),
  });

  const body = await res.json();
  assert.equal(res.status, 201);
  assert.equal(body.success, true);
  assert.ok(body.data.contactId.startsWith('CNT-'));
  assert.equal(body.data.isEmergency, true);
});

test('GET /api/student-services/contacts - Student accesses contact directory', async () => {
  const res = await fetch(`${baseUrl}/student-services/contacts`, {
    headers: { Authorization: `Bearer ${studentAToken}` },
  });

  const body = await res.json();
  assert.equal(res.status, 200);
  assert.ok(body.data.length >= 1);
  const emergencyContact = body.data.find((c) => c.title === 'Hostel A Night Security & Medical Desk');
  assert.ok(emergencyContact);
  assert.equal(emergencyContact.phoneNumber, '+919876543210');
});

// ============================================================================
// 4. STUDENT FEEDBACK TESTS
// ============================================================================

let createdFeedbackId;

test('POST /api/student-services/feedback - Student submits 5-star feedback', async () => {
  const res = await fetch(`${baseUrl}/student-services/feedback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentAToken}`,
    },
    body: JSON.stringify({
      category: 'HOSTEL',
      rating: 5,
      title: 'Smooth Wi-Fi and Clean Reading Hall',
      comment: 'Very impressed with high-speed internet and quiet study room facilities.',
      isAnonymous: false,
    }),
  });

  const body = await res.json();
  assert.equal(res.status, 201);
  assert.equal(body.success, true);
  assert.ok(body.data.feedbackId.startsWith('SFB-'));
  assert.equal(body.data.rating, 5);
  createdFeedbackId = body.data._id;
});

test('POST /api/student-services/feedback/:id/respond - Warden responds to student feedback', async () => {
  const res = await fetch(`${baseUrl}/student-services/feedback/${createdFeedbackId}/respond`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${wardenAToken}`,
    },
    body: JSON.stringify({
      responseNote: 'Thank you for your valuable feedback! We strive to maintain high standards.',
    }),
  });

  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.data.status, 'ACKNOWLEDGED');
  assert.ok(body.data.responseNote.includes('Thank you'));
});

// ============================================================================
// 5. STATS & SCHEDULER LIFECYCLE JOB TESTS
// ============================================================================

test('GET /api/student-services/stats - Fetches unified stats overview', async () => {
  const res = await fetch(`${baseUrl}/student-services/stats`, {
    headers: { Authorization: `Bearer ${studentAToken}` },
  });

  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.ok(body.data.notices);
  assert.ok(body.data.serviceRequests);
  assert.equal(body.data.serviceRequests.closed, 1);
  assert.ok(body.data.emergencyContactsCount >= 1);
  assert.equal(body.data.feedback.averageRating, 5);
});

test('processStudentServicesLifecycleJobs - Auto-publishes scheduled draft notices and expires outdated ones', async () => {
  const pastDate = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const futureDate = new Date(Date.now() + 2 * 60 * 60 * 1000);

  // 1. Notice ready to publish
  const scheduledNotice = await Notice.create({
    noticeId: 'NOT-TEST-SCHED-01',
    title: 'Scheduled Library Timings Notice',
    description: 'Library hours extended.',
    status: 'DRAFT',
    publishAt: pastDate,
    createdBy: adminUser._id,
  });

  // 2. Active notice that has reached expiration
  const expiredNotice = await Notice.create({
    noticeId: 'NOT-TEST-EXPIRE-01',
    title: 'Temporary Water Shutoff',
    description: 'Shutoff completed.',
    status: 'PUBLISHED',
    publishAt: pastDate,
    expiresAt: pastDate,
    createdBy: adminUser._id,
  });

  const results = await processStudentServicesLifecycleJobs(new Date());
  assert.ok(results.publishedNoticesCount >= 1);
  assert.ok(results.expiredNoticesCount >= 1);

  const checkedScheduled = await Notice.findById(scheduledNotice._id);
  assert.equal(checkedScheduled.status, 'PUBLISHED');

  const checkedExpired = await Notice.findById(expiredNotice._id);
  assert.equal(checkedExpired.status, 'EXPIRED');
  assert.equal(checkedExpired.isActive, false);
});
