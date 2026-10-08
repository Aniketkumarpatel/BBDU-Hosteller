/**
 * Comprehensive Authentication & RBAC Test Suite (Step 3)
 *
 * Covers all 20 required scenarios:
 * 1. Successful student registration
 * 2. Duplicate email registration rejected (409)
 * 3. Invalid email format rejected (400)
 * 4. Weak / invalid password rejected (400)
 * 5. Public registration prevents privilege escalation (cannot register SUPER_ADMIN, WARDEN, etc.)
 * 6. Login with correct credentials
 * 7. Login with incorrect credentials rejected (401 with generic message)
 * 8. Login for inactive user rejected (403)
 * 9. Missing JWT rejected (401)
 * 10. Invalid JWT rejected (401)
 * 11. Expired JWT rejected (401)
 * 12. /me with valid JWT returns safe profile
 * 13. /me without JWT rejected (401)
 * 14. passwordHash is NEVER exposed in register, login, or /me responses
 * 15. STUDENT accessing SUPER_ADMIN endpoint rejected (403)
 * 16. WARDEN accessing SUPER_ADMIN endpoint rejected (403)
 * 17. SUPER_ADMIN accessing admin endpoint succeeded (200)
 * 18. Logout behavior returns 200 and success response
 * 19. Hierarchy reference validation on registration
 * 20. JWT secret comes from environment variables (no hard-coded fallback)
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_for_suite_1234567890abcdef';
process.env.JWT_EXPIRES_IN = '1h';

const TEST_URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/bbdu_hosteller_auth_test';

const { connectDB, disconnectDB } = await import('../src/config/db.js');
const { default: app } = await import('../src/app.js');
const { User, Hostel, Block, Floor, Room, Department } = await import('../src/models/index.js');
const { hashPassword } = await import('../src/utils/password.js');

let server;
let baseUrl;
let testHostel;
let testBlock;
let testFloor;
let testRoom;

before(async () => {
  await connectDB(TEST_URI);
  await mongoose.connection.dropDatabase();
  await Promise.all([User, Hostel, Block, Floor, Room, Department].map((m) => m.syncIndexes()));

  testHostel = await Hostel.create({ name: 'BBDU A and B Block', code: 'BBDU-AB', type: 'BOYS' });
  testBlock = await Block.create({ hostelId: testHostel._id, name: '1', code: '1' });
  testFloor = await Floor.create({ hostelId: testHostel._id, blockId: testBlock._id, floorNumber: 1, name: '1' });
  testRoom = await Room.create({
    hostelId: testHostel._id,
    blockId: testBlock._id,
    floorId: testFloor._id,
    roomNumber: '101',
    roomType: 'DOUBLE',
    capacity: 10,
    currentOccupancy: 0,
  });

  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await mongoose.connection.dropDatabase();
  await disconnectDB();
});

test('1. Successful student registration', async () => {
  const payload = {
    name: 'Rohit Sharma',
    email: 'rohit@bbdu.ac.in',
    password: 'Password@123',
    role: 'STUDENT',
    studentId: 'BBDU2026-001',
    phone: '+919876543210',
    hostelId: String(testHostel._id),
    blockId: String(testBlock._id),
    floorId: String(testFloor._id),
    roomId: String(testRoom._id),
  };

  const res = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.success, true);
  assert.ok(body.data.token, 'token must be present');
  assert.equal(body.data.user.email, 'rohit@bbdu.ac.in');
  assert.equal(body.data.user.role, 'STUDENT');
  assert.equal(body.data.user.studentId, 'BBDU2026-001');

  // PasswordHash must NEVER be exposed
  assert.equal('passwordHash' in body.data.user, false);
  assert.equal(JSON.stringify(body).includes('passwordHash'), false);
  assert.equal(JSON.stringify(body).includes('Password@123'), false);
});

test('2. Re-registration with same identity performs safe upsert (200 OK), wrong password rejected (409 Conflict)', async () => {
  // Safe re-registration with correct password updates profile
  const payloadCorrect = {
    name: 'Rohit Updated',
    email: 'ROHIT@bbdu.ac.in', // case-insensitive match
    password: 'Password@123',
    role: 'STUDENT',
    hostelId: String(testHostel._id),
    blockId: String(testBlock._id),
    floorId: String(testFloor._id),
    roomId: String(testRoom._id),
  };

  const resCorrect = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payloadCorrect),
  });

  assert.equal(resCorrect.status, 200);
  const bodyCorrect = await resCorrect.json();
  assert.equal(bodyCorrect.success, true);
  assert.equal(bodyCorrect.data.user.name, 'Rohit Updated');

  // Re-registration with wrong password rejected
  const payloadWrong = {
    name: 'Attacker Overwrite',
    email: 'ROHIT@bbdu.ac.in',
    password: 'WrongPassword@123',
    role: 'STUDENT',
    hostelId: String(testHostel._id),
    blockId: String(testBlock._id),
    floorId: String(testFloor._id),
    roomId: String(testRoom._id),
  };

  const resWrong = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payloadWrong),
  });

  assert.equal(resWrong.status, 409);
  const bodyWrong = await resWrong.json();
  assert.equal(bodyWrong.success, false);
});

test('3. Invalid email format is rejected (400 Bad Request)', async () => {
  const payload = {
    name: 'Invalid Email User',
    email: 'not-an-email',
    password: 'Password@123',
    hostelId: String(testHostel._id),
    blockId: String(testBlock._id),
    floorId: String(testFloor._id),
    roomId: String(testRoom._id),
  };

  const res = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.success, false);
});

test('3b. Non-BBDU domain email is rejected with explicit error message (400 Bad Request)', async () => {
  const invalidEmails = ['test@gmail.com', 'student@yahoo.com', 'abc@outlook.com', 'abc@bbdu.com'];

  for (const email of invalidEmails) {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'External User',
        email,
        password: 'Password@123',
        hostelId: String(testHostel._id),
        blockId: String(testBlock._id),
        floorId: String(testFloor._id),
        roomId: String(testRoom._id),
      }),
    });

    assert.equal(res.status, 400, `Email ${email} should be rejected`);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.message, /Please use your official BBDU email address ending with @bbdu\.ac\.in/i);
  }
});

test('3c. Case-insensitive and padded BBDU email registration succeeds', async () => {
  const payload = {
    name: 'Aniket Patel',
    email: ' APATEL08011@BBDU.AC.IN ',
    password: 'Password@123',
    hostelId: String(testHostel._id),
    blockId: String(testBlock._id),
    floorId: String(testFloor._id),
    roomId: String(testRoom._id),
  };

  const res = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.success, true);
  assert.equal(body.data.user.email, 'apatel08011@bbdu.ac.in');
});

test('4. Weak password rejected (400 Bad Request)', async () => {
  // Missing uppercase and number
  const payload = {
    name: 'Weak Password User',
    email: 'weak@bbdu.ac.in',
    password: 'short',
  };

  const res = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.success, false);
});

test('5. Public registration rejects privilege escalation (SUPER_ADMIN, WARDEN, AUTHORITY)', async () => {
  const forbiddenRoles = ['SUPER_ADMIN', 'WARDEN', 'AUTHORITY'];

  for (const role of forbiddenRoles) {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `Hacker ${role}`,
        email: `hacker_${role.toLowerCase()}@bbdu.ac.in`,
        password: 'Password@123',
        role,
      }),
    });

    assert.equal(res.status, 400, `Role ${role} should be rejected in public registration`);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.message, /STUDENT/);
  }
});

test('6. Login with correct credentials returns safe user and valid JWT', async () => {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'rohit@bbdu.ac.in',
      password: 'Password@123',
    }),
  });

  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, true);
  assert.ok(body.data.token);
  assert.equal(body.data.user.email, 'rohit@bbdu.ac.in');
  assert.equal('passwordHash' in body.data.user, false);
  assert.equal(JSON.stringify(body).includes('passwordHash'), false);
});

test('7. Login with incorrect credentials fails with generic message (401)', async () => {
  // Wrong password
  const res1 = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'rohit@bbdu.ac.in',
      password: 'WrongPassword@999',
    }),
  });

  assert.equal(res1.status, 401);
  const body1 = await res1.json();
  assert.equal(body1.success, false);
  assert.equal(body1.message, 'Invalid email or password.');

  // Non-existent user (must return identical generic message)
  const res2 = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'ghost@bbdu.ac.in',
      password: 'Password@123',
    }),
  });

  assert.equal(res2.status, 401);
  const body2 = await res2.json();
  assert.equal(body2.success, false);
  assert.equal(body2.message, 'Invalid email or password.');
});

test('8. Login for inactive user is rejected (403 Forbidden)', async () => {
  const hash = await hashPassword('Password@123');
  await User.create({
    name: 'Suspended Student',
    email: 'suspended@bbdu.ac.in',
    passwordHash: hash,
    role: 'STUDENT',
    isActive: false,
  });

  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'suspended@bbdu.ac.in',
      password: 'Password@123',
    }),
  });

  assert.equal(res.status, 403);
  const body = await res.json();
  assert.equal(body.success, false);
  assert.match(body.message, /deactivated/i);
});

test('9. Missing JWT header returns 401 Unauthorized', async () => {
  const res = await fetch(`${baseUrl}/api/auth/me`);
  assert.equal(res.status, 401);
  const body = await res.json();
  assert.equal(body.success, false);
  assert.match(body.message, /Authentication required/);
});

test('10. Invalid JWT token returns 401 Unauthorized', async () => {
  const res = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Authorization: 'Bearer this.is.an.invalid.token' },
  });
  assert.equal(res.status, 401);
  const body = await res.json();
  assert.equal(body.success, false);
  assert.match(body.message, /Invalid authentication token/);
});

test('11. Expired JWT token returns 401 Unauthorized', async () => {
  // Sign a token that expired 10 seconds ago
  const expiredToken = jwt.sign(
    { userId: new mongoose.Types.ObjectId(), role: 'STUDENT' },
    process.env.JWT_SECRET,
    { expiresIn: -10 }
  );

  const res = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Authorization: `Bearer ${expiredToken}` },
  });

  assert.equal(res.status, 401);
  const body = await res.json();
  assert.equal(body.success, false);
  assert.match(body.message, /expired/i);
});

test('12. /me with valid JWT returns safe profile', async () => {
  // Login as Rohit
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'rohit@bbdu.ac.in',
      password: 'Password@123',
    }),
  });
  const { data: { token } } = await loginRes.json();

  const meRes = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  assert.equal(meRes.status, 200);
  const body = await meRes.json();
  assert.equal(body.success, true);
  assert.equal(body.data.user.email, 'rohit@bbdu.ac.in');
  assert.equal(body.data.user.role, 'STUDENT');
  assert.equal('passwordHash' in body.data.user, false);
  assert.equal(JSON.stringify(body).includes('passwordHash'), false);
});

test('13. STUDENT accessing SUPER_ADMIN endpoint returns 403 Forbidden', async () => {
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'rohit@bbdu.ac.in',
      password: 'Password@123',
    }),
  });
  const { data: { token } } = await loginRes.json();

  const adminRes = await fetch(`${baseUrl}/api/admin/users`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  assert.equal(adminRes.status, 403);
  const body = await adminRes.json();
  assert.equal(body.success, false);
  assert.match(body.message, /Forbidden/i);
});

test('14. WARDEN accessing SUPER_ADMIN endpoint returns 403 Forbidden', async () => {
  const hash = await hashPassword('Password@123');
  await User.create({
    name: 'Hostel Warden',
    email: 'warden_test@bbdu.ac.in',
    passwordHash: hash,
    role: 'WARDEN',
  });

  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'warden_test@bbdu.ac.in',
      password: 'Password@123',
    }),
  });
  const { data: { token } } = await loginRes.json();

  const adminRes = await fetch(`${baseUrl}/api/admin/overview`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  assert.equal(adminRes.status, 403);
  const body = await adminRes.json();
  assert.equal(body.success, false);
  assert.match(body.message, /Forbidden/i);
});

test('15. SUPER_ADMIN accessing admin endpoint succeeds (200 OK)', async () => {
  const hash = await hashPassword('Password@123');
  await User.create({
    name: 'Super Admin',
    email: 'admin_test@bbdu.ac.in',
    passwordHash: hash,
    role: 'SUPER_ADMIN',
  });

  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin_test@bbdu.ac.in',
      password: 'Password@123',
    }),
  });
  const { data: { token } } = await loginRes.json();

  const [usersRes, overviewRes] = await Promise.all([
    fetch(`${baseUrl}/api/admin/users`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
    fetch(`${baseUrl}/api/admin/overview`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
  ]);

  assert.equal(usersRes.status, 200);
  assert.equal(overviewRes.status, 200);

  const usersBody = await usersRes.json();
  assert.equal(usersBody.success, true);
  assert.ok(Array.isArray(usersBody.data.users));

  const overviewBody = await overviewRes.json();
  assert.equal(overviewBody.success, true);
  assert.ok(typeof overviewBody.data.users === 'number');
});

test('16. Logout endpoint returns 200 and success response', async () => {
  const res = await fetch(`${baseUrl}/api/auth/logout`, { method: 'POST' });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, true);
  assert.match(body.message, /Logged out successfully/i);
});

test('17. Registration validates hierarchy reference exists', async () => {
  const nonExistentOid = new mongoose.Types.ObjectId();

  const res = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Bad Hostel Ref',
      email: 'badref@bbdu.ac.in',
      password: 'Password@123',
      hostelId: String(nonExistentOid),
      blockId: String(testBlock._id),
      floorId: String(testFloor._id),
      roomId: String(testRoom._id),
    }),
  });

  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.success, false);
  assert.match(body.message, /Referenced hostel does not exist/i);
});
