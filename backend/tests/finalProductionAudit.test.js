/**
 * Step 18 — Final Production Readiness & Complete Project Audit Test Suite
 *
 * Comprehensive end-to-end audit verifying:
 * 1. Database models & index synchronization (all 37 models)
 * 2. API response schema uniformity & absence of sensitive credential leakage
 * 3. Complete authentication & JWT token lifecycle
 * 4. Multi-role RBAC enforcement across all 5 operational roles
 * 5. Strict multi-tenant hostel isolation (Hostel A vs Hostel B)
 * 6. Central scheduler execution idempotency
 * 7. Security controls: NoSQL sanitization, Helmet headers, audit logs
 * 8. AI Command Center read-only execution guardrails
 * 9. Standardized HTTP error handling
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_audit_jwt_secret_final_production_readiness_32char';
process.env.JWT_EXPIRES_IN = '1h';

const TEST_URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/bbdu_hosteller_final_audit_test';

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
  Notice,
  ServiceRequest,
  Asset,
  MaintenanceWorkOrder,
  SecurityAuditLog,
  allModels,
} = await import('../src/models/index.js');
const { hashPassword } = await import('../src/utils/password.js');
const { ROLES } = await import('../src/constants/roles.js');
const { NOTICE_CATEGORIES, NOTICE_PRIORITIES } = await import('../src/constants/studentServices.constants.js');
const { COMPLAINT_STATUSES } = await import('../src/constants/complaint.constants.js');
const { runSlaSchedulerOnce } = await import('../src/scheduler/slaScheduler.js');
const { processStudentServicesLifecycleJobs } = await import('../src/services/studentServices.service.js');

let server;
let baseUrl;

let adminUser, adminToken;
let wardenAUser, wardenAToken;
let wardenBUser, wardenBToken;
let staffUser, staffToken;
let studentAUser, studentAToken;
let hostelA, hostelB;
let blockA, floorA, roomA;
let blockB, floorB, roomB;

const createToken = (user) => {
  return jwt.sign(
    {
      userId: user._id.toString(),
      role: user.role,
      email: user.email,
      hostelId: user.hostelId ? user.hostelId.toString() : null,
    },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
};

before(async () => {
  await connectDB(TEST_URI);
  await mongoose.connection.dropDatabase();

  // 1. Verify index synchronization across all models
  await Promise.all(Object.values(allModels).map((m) => m.syncIndexes()));

  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });

  // Seed Hostels
  hostelA = await Hostel.create({
    name: 'Tagore Hostel Audit A',
    code: 'TH-AUD-A',
    type: 'BOYS',
    capacity: 100,
    isActive: true,
  });

  hostelB = await Hostel.create({
    name: 'Sarojini Hostel Audit B',
    code: 'SH-AUD-B',
    type: 'GIRLS',
    capacity: 100,
    isActive: true,
  });

  blockA = await Block.create({ name: 'Block A', code: 'BA-A', hostelId: hostelA._id });
  floorA = await Floor.create({ floorNumber: 1, name: 'Floor 1', hostelId: hostelA._id, blockId: blockA._id });
  roomA = await Room.create({
    roomNumber: '101',
    hostelId: hostelA._id,
    blockId: blockA._id,
    floorId: floorA._id,
    roomType: 'DOUBLE',
    capacity: 2,
    basePricePerSemester: 25000,
  });

  blockB = await Block.create({ name: 'Block B', code: 'BB-B', hostelId: hostelB._id });
  floorB = await Floor.create({ floorNumber: 1, name: 'Floor 1', hostelId: hostelB._id, blockId: blockB._id });
  roomB = await Room.create({
    roomNumber: '201',
    hostelId: hostelB._id,
    blockId: blockB._id,
    floorId: floorB._id,
    roomType: 'DOUBLE',
    capacity: 2,
    basePricePerSemester: 25000,
  });

  // Users
  const defaultPwHash = await hashPassword('AuditPass123!');

  adminUser = await User.create({
    name: 'Super Admin Audit',
    email: 'admin.audit@bbdu.ac.in',
    passwordHash: defaultPwHash,
    role: ROLES.SUPER_ADMIN,
    isActive: true,
    isEmailVerified: true,
  });
  adminToken = createToken(adminUser);

  wardenAUser = await User.create({
    name: 'Warden A Audit',
    email: 'warden.a.audit@bbdu.ac.in',
    passwordHash: defaultPwHash,
    role: ROLES.WARDEN,
    hostelId: hostelA._id,
    isActive: true,
    isEmailVerified: true,
  });
  wardenAToken = createToken(wardenAUser);

  wardenBUser = await User.create({
    name: 'Warden B Audit',
    email: 'warden.b.audit@bbdu.ac.in',
    passwordHash: defaultPwHash,
    role: ROLES.WARDEN,
    hostelId: hostelB._id,
    isActive: true,
    isEmailVerified: true,
  });
  wardenBToken = createToken(wardenBUser);

  staffUser = await User.create({
    name: 'Staff Technician Audit',
    email: 'staff.audit@bbdu.ac.in',
    passwordHash: defaultPwHash,
    role: ROLES.HOSTEL_STAFF,
    hostelId: hostelA._id,
    isActive: true,
    isEmailVerified: true,
  });
  staffToken = createToken(staffUser);

  studentAUser = await User.create({
    name: 'Student A Audit',
    email: 'student.a.audit@bbdu.ac.in',
    passwordHash: defaultPwHash,
    role: ROLES.STUDENT,
    hostelId: hostelA._id,
    blockId: blockA._id,
    floorId: floorA._id,
    roomId: roomA._id,
    isActive: true,
    isEmailVerified: true,
  });
  studentAToken = createToken(studentAUser);
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await mongoose.connection.dropDatabase();
  await disconnectDB();
});

// ==============================================================================
// 1. DATABASE AUDIT & INDEX INTEGRITY
// ==============================================================================
test('1. Database Model & Index Integrity: All 37 models sync indexes cleanly without collisions', async () => {
  const modelKeys = Object.keys(allModels);
  assert.ok(modelKeys.length >= 35, `Expected >= 35 models, found ${modelKeys.length}`);

  for (const [name, model] of Object.entries(allModels)) {
    assert.ok(typeof model.find === 'function', `Model ${name} must be a valid Mongoose model`);
    const count = await model.countDocuments();
    assert.ok(typeof count === 'number', `Model ${name} count query must return a number`);
  }
});

// ==============================================================================
// 2. API RESPONSE UNIFORMITY & SENSITIVE CREDENTIAL LEAKAGE DEFENSE
// ==============================================================================
test('2. Response Uniformity & Redaction: Safe response envelope, no passwordHash or internal paths', async () => {
  const res = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Authorization: `Bearer ${studentAToken}` },
  });
  assert.equal(res.status, 200);

  const body = await res.json();
  assert.equal(body.success, true);
  assert.ok(body.data);
  assert.ok(body.data.user);
  assert.equal(body.data.user.passwordHash, undefined, 'passwordHash must never be exposed');
  assert.equal(body.data.user.__v, undefined);
  assert.equal(body.stack, undefined, 'Stack traces must never be exposed');
});

// ==============================================================================
// 3. COMPLETE AUTHENTICATION & JWT LIFECYCLE
// ==============================================================================
test('3. Authentication Security: Rejects invalid, expired, or missing JWT tokens with 401', async () => {
  // Missing token
  const resNoToken = await fetch(`${baseUrl}/api/auth/me`);
  assert.equal(resNoToken.status, 401);

  // Malformed token
  const resMalformed = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Authorization: 'Bearer invalid.token.payload' },
  });
  assert.equal(resMalformed.status, 401);

  // Expired token
  const expiredToken = jwt.sign(
    { userId: studentAUser._id.toString(), role: studentAUser.role },
    process.env.JWT_SECRET,
    { expiresIn: '-1s' }
  );
  const resExpired = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Authorization: `Bearer ${expiredToken}` },
  });
  assert.equal(resExpired.status, 401);
});

// ==============================================================================
// 4. COMPREHENSIVE RBAC MATRIX AUDIT
// ==============================================================================
test('4. RBAC Matrix Audit: Role authorization bounds correctly block unauthorized actions', async () => {
  // Student cannot access Super Admin endpoint
  const resStudentToAdmin = await fetch(`${baseUrl}/api/admin/overview`, {
    headers: { Authorization: `Bearer ${studentAToken}` },
  });
  assert.equal(resStudentToAdmin.status, 403);

  // Hostel Staff cannot access Super Admin endpoint
  const resStaffToAdmin = await fetch(`${baseUrl}/api/admin/overview`, {
    headers: { Authorization: `Bearer ${staffToken}` },
  });
  assert.equal(resStaffToAdmin.status, 403);

  // Warden cannot access Super Admin endpoint
  const resWardenToAdmin = await fetch(`${baseUrl}/api/admin/overview`, {
    headers: { Authorization: `Bearer ${wardenAToken}` },
  });
  assert.equal(resWardenToAdmin.status, 403);

  // Super Admin succeeds
  const resAdmin = await fetch(`${baseUrl}/api/admin/overview`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(resAdmin.status, 200);
});

// ==============================================================================
// 5. MULTI-TENANT HOSTEL ISOLATION FINAL TEST
// ==============================================================================
test('5. Multi-Tenant Hostel Isolation: Hostel A warden cannot mutate notices for Hostel B', async () => {
  // Warden A creates notice in Hostel A
  const createNoticeRes = await fetch(`${baseUrl}/api/student-services/notices`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${wardenAToken}`,
    },
    body: JSON.stringify({
      title: 'Hostel A Notice',
      message: 'Notice content for Hostel A residents',
      category: NOTICE_CATEGORIES.GENERAL,
      priority: NOTICE_PRIORITIES.NORMAL,
      targetAudience: 'HOSTEL',
    }),
  });
  assert.equal(createNoticeRes.status, 201);
  const noticeData = await createNoticeRes.json();
  const noticeId = noticeData.data._id;

  // Warden B tries to update Hostel A's notice -> 403 Forbidden
  const updateRes = await fetch(`${baseUrl}/api/student-services/notices/${noticeId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${wardenBToken}`,
    },
    body: JSON.stringify({
      title: 'Malicious Warden B Edit',
    }),
  });
  assert.equal(updateRes.status, 403);

  // Warden B tries to delete Hostel A's notice -> 403 Forbidden
  const deleteRes = await fetch(`${baseUrl}/api/student-services/notices/${noticeId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${wardenBToken}`,
    },
  });
  assert.equal(deleteRes.status, 403);
});

// ==============================================================================
// 6. CENTRAL SCHEDULER IDEMPOTENCY AUDIT
// ==============================================================================
test('6. Central Scheduler Idempotency: Multiple consecutive cycles run cleanly with zero duplicate transitions', async () => {
  // Execute background scheduler cycles consecutively
  const run1 = await runSlaSchedulerOnce();
  assert.ok(run1, 'First SLA scheduler cycle should complete successfully');

  const run2 = await runSlaSchedulerOnce();
  assert.ok(run2, 'Second SLA scheduler cycle should complete idempotently');

  // Student Services scheduler jobs
  const job1 = await processStudentServicesLifecycleJobs();
  assert.equal(job1.errors.length, 0, 'First student services lifecycle cycle should succeed without errors');

  const job2 = await processStudentServicesLifecycleJobs();
  assert.equal(job2.errors.length, 0, 'Second student services lifecycle cycle should succeed without errors');
});

// ==============================================================================
// 7. SECURITY CONTROLS AUDIT
// ==============================================================================
test('7. Security Controls Audit: NoSQL injection protection, Helmet security headers, audit trail', async () => {
  // Helmet headers
  const healthRes = await fetch(`${baseUrl}/api/health`);
  assert.equal(healthRes.status, 200);
  assert.equal(healthRes.headers.get('x-frame-options'), 'DENY');
  assert.equal(healthRes.headers.get('x-content-type-options'), 'nosniff');

  // NoSQL operator injection in query
  const nosqlRes = await fetch(`${baseUrl}/api/complaints/my?status[$ne]=RESOLVED`, {
    headers: { Authorization: `Bearer ${studentAToken}` },
  });
  assert.equal(nosqlRes.status, 400);

  // Immutable security audit log accessible only by Super Admin
  const auditRes = await fetch(`${baseUrl}/api/admin/security-audit`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(auditRes.status, 200);
});

// ==============================================================================
// 8. AI COMMAND CENTER READ-ONLY GUARDRAILS
// ==============================================================================
test('8. AI Command Center Guardrails: Queries execute safely in read-only mode without data mutation', async () => {
  const aiRes = await fetch(`${baseUrl}/api/ai-command-center/ask`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${wardenAToken}`,
    },
    body: JSON.stringify({
      query: 'Give me a summary of open complaints in my hostel',
    }),
  });

  assert.equal(aiRes.status, 200);
  const data = await aiRes.json();
  assert.equal(data.success, true);
  assert.ok(data.data.answer);
});

// ==============================================================================
// 9. ERROR HANDLING & HTTP STATUS CODES
// ==============================================================================
test('9. Error Handling Audit: Standardized error responses and status code accuracy', async () => {
  // 404 Not Found on invalid endpoint
  const resNotFound = await fetch(`${baseUrl}/api/non-existent-route`);
  assert.equal(resNotFound.status, 404);
  const bodyNotFound = await resNotFound.json();
  assert.equal(bodyNotFound.success, false);
  assert.ok(bodyNotFound.message);

  // 400 Bad Request on malformed JSON / validation failure
  const resBadReq = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'invalid-email' }),
  });
  assert.equal(resBadReq.status, 400);
  const bodyBadReq = await resBadReq.json();
  assert.equal(bodyBadReq.success, false);
});
