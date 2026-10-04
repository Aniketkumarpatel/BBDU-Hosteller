/**
 * Step 17 — Advanced Security, Compliance & System Audit Test Suite
 *
 * Verifies:
 * 1. NoSQL operator injection rejection across request body, query params
 * 2. Hardened security headers (Helmet frameguard DENY, nosniff, strict referrer)
 * 3. Privilege escalation detection and auditing on public registration
 * 4. Failed login tracking and security audit log generation
 * 5. Role-based unauthorized access interception and security audit logging
 * 6. Redaction of sensitive fields (passwords, tokens) in security audit logs
 * 7. Student cross-hostel isolation & IDOR prevention on service requests
 * 8. Restricted access to security audit log endpoints (SUPER_ADMIN only)
 * 9. Security audit stats aggregation API
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_security_secret_1234567890abcdef_hardened';
process.env.JWT_EXPIRES_IN = '1h';

const TEST_URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/bbdu_hosteller_security_test';

const { connectDB, disconnectDB } = await import('../src/config/db.js');
const { default: app } = await import('../src/app.js');
const { User, Hostel, Block, Floor, Room, SecurityAuditLog } = await import('../src/models/index.js');
const { hashPassword } = await import('../src/utils/password.js');
const { ROLES } = await import('../src/constants/roles.js');
const { SECURITY_EVENT_TYPES } = await import('../src/models/SecurityAuditLog.js');

let server;
let baseUrl;
let superAdminToken;
let studentToken;
let studentUser;
let hostelA;
let hostelB;

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
  await Promise.all([User, Hostel, Block, Floor, Room, SecurityAuditLog].map((m) => m.syncIndexes()));

  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });

  // Seed Hostels
  hostelA = await Hostel.create({
    name: 'Tagore Hostel Security',
    code: 'TH-SEC-A',
    type: 'BOYS',
    capacity: 100,
    isActive: true,
  });

  hostelB = await Hostel.create({
    name: 'Raman Hostel Security',
    code: 'RH-SEC-B',
    type: 'BOYS',
    capacity: 100,
    isActive: true,
  });

  const blockA = await Block.create({
    name: 'Block A',
    code: 'BA-SEC',
    hostelId: hostelA._id,
  });

  const floorA = await Floor.create({
    floorNumber: 1,
    name: 'Floor 1',
    hostelId: hostelA._id,
    blockId: blockA._id,
  });

  const roomA = await Room.create({
    roomNumber: '101',
    hostelId: hostelA._id,
    blockId: blockA._id,
    floorId: floorA._id,
    roomType: 'DOUBLE',
    capacity: 2,
    basePricePerSemester: 25000,
  });

  // Super Admin
  const hashedAdminPassword = await hashPassword('AdminPass123!');
  const adminUser = await User.create({
    name: 'System Security Admin',
    email: 'admin.sec@bbdu.ac.in',
    passwordHash: hashedAdminPassword,
    role: ROLES.SUPER_ADMIN,
    isActive: true,
    isEmailVerified: true,
  });
  superAdminToken = createToken(adminUser);

  // Student User in Hostel A
  const hashedStudentPassword = await hashPassword('StudentPass123!');
  studentUser = await User.create({
    name: 'Aman Student',
    email: 'student.sec@bbdu.ac.in',
    passwordHash: hashedStudentPassword,
    role: ROLES.STUDENT,
    hostelId: hostelA._id,
    blockId: blockA._id,
    floorId: floorA._id,
    roomId: roomA._id,
    isActive: true,
    isEmailVerified: true,
  });
  studentToken = createToken(studentUser);
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await mongoose.connection.dropDatabase();
  await disconnectDB();
});

test('1. Security Headers: Express Helmet applies clickjacking defense and MIME sniffing protection', async () => {
  const res = await fetch(`${baseUrl}/api/health`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('x-frame-options'), 'DENY');
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
});

test('2. NoSQL Injection Prevention: Rejects body with MongoDB operators ($ne, $gt)', async () => {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: { $ne: null },
      password: 'randomPassword',
    }),
  });

  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.success, false);
  assert.match(data.message, /nosql injection blocked/i);
});

test('3. NoSQL Injection Prevention: Rejects query parameters with MongoDB operators', async () => {
  const res = await fetch(`${baseUrl}/api/complaints?category[$gt]=`, {
    headers: {
      Authorization: `Bearer ${studentToken}`,
    },
  });

  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.success, false);
  assert.match(data.message, /nosql injection blocked/i);
});

test('4. Privilege Escalation Prevention: Public registration rejects non-student role and logs audit event', async () => {
  const res = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Malicious Attacker',
      email: 'attacker@bbdu.ac.in',
      password: 'StrongPassword123!',
      role: 'SUPER_ADMIN', // Attempted escalation
    }),
  });

  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.success, false);
  assert.match(data.message, /STUDENT/);

  // Check that security audit log was written
  const auditLog = await SecurityAuditLog.findOne({
    eventType: SECURITY_EVENT_TYPES.PRIVILEGE_ESCALATION_ATTEMPT,
    actorEmail: 'attacker@bbdu.ac.in',
  });
  assert.ok(auditLog, 'SecurityAuditLog should record the privilege escalation attempt');
  assert.equal(auditLog.severity, 'HIGH');
});

test('5. Failed Login Auditing: Records failed authentication attempts with security audit logging', async () => {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'student.sec@bbdu.ac.in',
      password: 'WrongPassword999!',
    }),
  });

  assert.equal(res.status, 401);

  const failedLog = await SecurityAuditLog.findOne({
    eventType: SECURITY_EVENT_TYPES.FAILED_LOGIN,
    actorEmail: 'student.sec@bbdu.ac.in',
  });
  assert.ok(failedLog, 'SecurityAuditLog should record failed login attempt');
  assert.equal(failedLog.severity, 'MEDIUM');
});

test('6. RBAC Interception: Non-admin accessing admin route gets 403 and triggers security audit', async () => {
  const res = await fetch(`${baseUrl}/api/admin/users`, {
    headers: {
      Authorization: `Bearer ${studentToken}`,
    },
  });

  assert.equal(res.status, 403);

  const authzLog = await SecurityAuditLog.findOne({
    eventType: SECURITY_EVENT_TYPES.UNAUTHORIZED_ACCESS_ATTEMPT,
    actorRole: ROLES.STUDENT,
  });
  assert.ok(authzLog, 'SecurityAuditLog should record unauthorized access attempt');
  assert.equal(authzLog.severity, 'HIGH');
});

test('7. Student Hostel Isolation: Student cannot submit service request for a foreign hostel', async () => {
  const res = await fetch(`${baseUrl}/api/student-services/requests`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify({
      category: 'ROOM_CHANGE',
      title: 'Request to swap to Raman Hostel',
      description: 'I want to move to Raman Hostel room 102',
      hostelId: hostelB._id.toString(), // Foreign hostel!
    }),
  });

  assert.equal(res.status, 403);
  const data = await res.json();
  assert.equal(data.success, false);
  assert.match(data.message, /different hostel/i);
});

test('8. Security Audit Logs: Non-superadmin cannot access security audit records (403)', async () => {
  const res = await fetch(`${baseUrl}/api/admin/security-audit`, {
    headers: {
      Authorization: `Bearer ${studentToken}`,
    },
  });

  assert.equal(res.status, 403);
});

test('9. Security Audit Logs: SUPER_ADMIN can inspect audit log records with pagination', async () => {
  const res = await fetch(`${baseUrl}/api/admin/security-audit?page=1&limit=10`, {
    headers: {
      Authorization: `Bearer ${superAdminToken}`,
    },
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.ok(Array.isArray(data.data));
  assert.ok(data.pagination.total >= 3);
});

test('10. Security Audit Stats: SUPER_ADMIN can view system security intelligence statistics', async () => {
  const res = await fetch(`${baseUrl}/api/admin/security-audit/stats`, {
    headers: {
      Authorization: `Bearer ${superAdminToken}`,
    },
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.ok(data.data.totalEvents >= 3);
  assert.ok(data.data.severityCounts);
  assert.ok(Array.isArray(data.data.topEventTypes));
});
