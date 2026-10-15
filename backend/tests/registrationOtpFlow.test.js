import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_for_suite_1234567890abcdef';
process.env.JWT_EXPIRES_IN = '1h';

const TEST_URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/bbdu_hosteller_test_reg_otp';

const { connectDB, disconnectDB } = await import('../src/config/db.js');
const { default: app } = await import('../src/app.js');
const { User, Hostel, Block, Floor, Room, Department, Otp } = await import('../src/models/index.js');

let server;
let baseUrl;
let testHostel;
let testBlock;
let testFloor;
let testRoom;

before(async () => {
  await connectDB(TEST_URI);
  await mongoose.connection.dropDatabase();
  await Promise.all([User, Hostel, Block, Floor, Room, Department, Otp].map((m) => m.syncIndexes()));

  testHostel = await Hostel.create({
    name: 'BBDU A and B Block',
    code: 'BBDU-AB-OTP',
    type: 'BOYS',
    address: 'BBD University Campus, Lucknow',
    isActive: true,
  });

  testBlock = await Block.create({
    name: 'Block 1',
    code: 'B1-OTP',
    hostelId: testHostel._id,
    isActive: true,
  });

  testFloor = await Floor.create({
    name: 'Floor 1',
    floorNumber: 1,
    hostelId: testHostel._id,
    blockId: testBlock._id,
    isActive: true,
  });

  testRoom = await Room.create({
    roomNumber: '101',
    roomType: 'DOUBLE',
    capacity: 2,
    currentOccupancy: 0,
    floorId: testFloor._id,
    blockId: testBlock._id,
    hostelId: testHostel._id,
    isActive: true,
  });

  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await disconnectDB();
});

test('1. Sending OTP to invalid email format is rejected (400 Bad Request)', async () => {
  const res = await fetch(`${baseUrl}/api/auth/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'not-an-email',
      role: 'STUDENT',
    }),
  });

  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.success, false);
  assert.match(data.message, /valid email/i);
});

test('1b. Sending OTP to a non-BBDU personal email address (@gmail.com) is rejected (400 Bad Request)', async () => {
  const res = await fetch(`${baseUrl}/api/auth/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'mytestuser@gmail.com',
      role: 'STUDENT',
      name: 'Gmail User',
    }),
  });

  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.success, false);
  assert.match(data.message, /@bbdu\.ac\.in/i);
});

test('2. Sending OTP for STUDENT generates OTP and returns preview in dev/simulated mode', async () => {
  const res = await fetch(`${baseUrl}/api/auth/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'student.otp@bbdu.ac.in',
      role: 'STUDENT',
      name: 'Rohan Sharma',
    }),
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.ok(data.data.previewOtp, 'Preview OTP should be present');
  assert.equal(data.data.previewOtp.length, 6);

  const otpDoc = await Otp.findOne({ email: 'student.otp@bbdu.ac.in' });
  assert.ok(otpDoc);
  assert.equal(otpDoc.otp, data.data.previewOtp);
  assert.equal(otpDoc.role, 'STUDENT');
  assert.equal(otpDoc.verified, false);
});

test('3. Verifying with invalid OTP fails and increments attempts', async () => {
  const res = await fetch(`${baseUrl}/api/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'student.otp@bbdu.ac.in',
      otp: '999999',
    }),
  });

  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.success, false);
  assert.match(data.message, /invalid otp/i);

  const otpDoc = await Otp.findOne({ email: 'student.otp@bbdu.ac.in' });
  assert.equal(otpDoc.attempts, 1);
});

test('4. Full Student registration with verified OTP succeeds and marks email verified', async () => {
  const otpDoc = await Otp.findOne({ email: 'student.otp@bbdu.ac.in' });
  assert.ok(otpDoc);

  const regRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Rohan Sharma',
      email: 'student.otp@bbdu.ac.in',
      studentId: 'BBDU2026-OTP-1',
      phone: '+919876543210',
      password: 'Password@123',
      role: 'STUDENT',
      hostelId: String(testHostel._id),
      blockId: String(testBlock._id),
      floorId: String(testFloor._id),
      roomNumber: '101',
      otp: otpDoc.otp,
    }),
  });

  assert.equal(regRes.status, 201);
  const regData = await regRes.json();
  assert.equal(regData.success, true);
  assert.equal(regData.data.user.role, 'STUDENT');
  assert.equal(regData.data.user.email, 'student.otp@bbdu.ac.in');
  assert.equal(regData.data.user.isEmailVerified, true);
  assert.ok(regData.data.token);

  // Check room occupancy incremented
  const updatedRoom = await Room.findById(testRoom._id);
  assert.equal(updatedRoom.currentOccupancy, 1);

  // OTP document consumed/removed
  const remainingOtp = await Otp.findOne({ email: 'student.otp@bbdu.ac.in' });
  assert.equal(remainingOtp, null);
});

test('5. Public Warden registration is refused: no OTP for a Warden and no Warden account is created', async () => {
  // A Warden OTP cannot be requested through the public endpoint
  const sendRes = await fetch(`${baseUrl}/api/auth/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'warden.official@bbdu.ac.in',
      role: 'WARDEN',
      name: 'Dr. Suresh Kumar',
    }),
  });
  assert.equal(sendRes.status, 400);

  // Even with a genuine verified email, registering as Warden is refused
  const studentOtpRes = await fetch(`${baseUrl}/api/auth/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'warden.official@bbdu.ac.in', role: 'STUDENT' }),
  });
  assert.equal(studentOtpRes.status, 200);
  const otp = (await studentOtpRes.json()).data.previewOtp;

  const regRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Dr. Suresh Kumar',
      email: 'warden.official@bbdu.ac.in',
      employeeId: 'EMP-WARDEN-001',
      phone: '+919123456789',
      password: 'Password@123',
      role: 'WARDEN',
      hostelId: String(testHostel._id),
      otp,
    }),
  });
  assert.equal(regRes.status, 400);
  assert.equal(await User.findOne({ email: 'warden.official@bbdu.ac.in' }), null);
});

test('6. Sending OTP for an already registered active email succeeds and allows re-registration update', async () => {
  const res = await fetch(`${baseUrl}/api/auth/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'student.otp@bbdu.ac.in',
      role: 'STUDENT',
    }),
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.ok(data.data.previewOtp);

  // Re-register with new password using OTP
  const regRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Rohan Sharma Updated',
      email: 'student.otp@bbdu.ac.in',
      password: 'NewPassword@123',
      role: 'STUDENT',
      hostelId: String(testHostel._id),
      blockId: String(testBlock._id),
      floorId: String(testFloor._id),
      roomNumber: '101',
      otp: data.data.previewOtp,
    }),
  });

  assert.equal(regRes.status, 200);
  const regData = await regRes.json();
  assert.equal(regData.success, true);
  assert.equal(regData.data.user.name, 'Rohan Sharma Updated');
});

test('7. A verified email cannot take over another student account through their Student ID', async () => {
  // student.otp@bbdu.ac.in already owns Student ID BBDU2026-OTP-1 (created in test 4)
  const before = await User.findOne({ email: 'student.otp@bbdu.ac.in' });
  assert.ok(before);

  const sendRes = await fetch(`${baseUrl}/api/auth/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'attacker.otp@bbdu.ac.in', role: 'STUDENT' }),
  });
  assert.equal(sendRes.status, 200);
  const otp = (await sendRes.json()).data.previewOtp;

  const regRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Not The Owner',
      email: 'attacker.otp@bbdu.ac.in',
      studentId: 'BBDU2026-OTP-1',
      password: 'Password@123',
      role: 'STUDENT',
      hostelId: String(testHostel._id),
      blockId: String(testBlock._id),
      floorId: String(testFloor._id),
      roomNumber: '102',
      otp,
    }),
  });
  assert.equal(regRes.status, 409);
  const body = await regRes.json();
  assert.equal(body.success, false);
  assert.equal(body.data?.token, undefined);

  // The owner's record is exactly as it was: same email, same name, same room
  const after = await User.findOne({ studentId: 'BBDU2026-OTP-1' });
  assert.equal(after.email, before.email);
  assert.equal(after.name, before.name);
  assert.equal(String(after.roomId), String(before.roomId));
  assert.equal(await User.findOne({ email: 'attacker.otp@bbdu.ac.in' }), null);
});

test('8. Wrong codes sent straight to /register are counted and the code is locked after 5 tries', async () => {
  const sendRes = await fetch(`${baseUrl}/api/auth/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'guesser.otp@bbdu.ac.in', role: 'STUDENT' }),
  });
  const realOtp = (await sendRes.json()).data.previewOtp;
  const wrongOtp = realOtp === '000000' ? '111111' : '000000';

  const attempt = (code) =>
    fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Guesser',
        email: 'guesser.otp@bbdu.ac.in',
        studentId: 'BBDU2026-OTP-9',
        password: 'Password@123',
        role: 'STUDENT',
        hostelId: String(testHostel._id),
        blockId: String(testBlock._id),
        floorId: String(testFloor._id),
        roomNumber: '103',
        otp: code,
      }),
    });

  for (let i = 0; i < 5; i += 1) {
    assert.equal((await attempt(wrongOtp)).status, 400);
  }
  // Now even the real code is refused, because the code was locked and removed
  assert.equal((await attempt(realOtp)).status, 400);
  assert.equal(await User.findOne({ email: 'guesser.otp@bbdu.ac.in' }), null);
});

test('9. In production a missing mail setup is an error and never hands back a working code', async () => {
  const { sendRegistrationOtpEmail } = await import('../src/services/email.service.js');
  const keys = ['EMAIL_USER', 'EMAIL_PASS', 'SMTP_USER', 'SMTP_PASS'];
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  const savedNodeEnv = process.env.NODE_ENV;
  try {
    for (const k of keys) delete process.env[k];

    process.env.NODE_ENV = 'production';
    await assert.rejects(
      () => sendRegistrationOtpEmail({ email: 'someone@bbdu.ac.in', otp: '123456' }),
      (err) => err.statusCode === 503 && !String(err.message).includes('123456')
    );

    process.env.NODE_ENV = 'test';
    const result = await sendRegistrationOtpEmail({ email: 'someone@bbdu.ac.in', otp: '123456' });
    assert.equal(result.previewOtp, '123456');
  } finally {
    process.env.NODE_ENV = savedNodeEnv;
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
});

test('10. The name typed by a user is escaped in the verification email', async () => {
  const { buildOtpEmailHtml } = await import('../src/services/email.service.js');
  const html = buildOtpEmailHtml({ name: '<a href="https://evil.example">Click</a><script>x()</script>', otp: '123456', role: 'STUDENT' });
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('<a href="https://evil.example">'));
  assert.ok(html.includes('&lt;script&gt;'));
});
