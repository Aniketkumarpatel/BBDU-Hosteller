import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_for_suite_1234567890abcdef';
process.env.JWT_EXPIRES_IN = '1h';

const baseUri = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/bbdu_hosteller_test';
const TEST_URI = baseUri.replace(/\/([^/?]+)(\?.*)?$/, '/$1_admin$2');

const { connectDB, disconnectDB } = await import('../src/config/db.js');
const { default: app } = await import('../src/app.js');
const { User, Hostel, Block, Floor, Room, Department } = await import('../src/models/index.js');
const { hashPassword } = await import('../src/utils/password.js');
const { signToken } = await import('../src/utils/jwt.js');

let server;
let baseUrl;
let adminToken;
let studentToken;
let wardenToken;

before(async () => {
  await connectDB(TEST_URI);
  await mongoose.connection.dropDatabase();
  await Promise.all([User, Hostel, Block, Floor, Room, Department].map((m) => m.syncIndexes()));

  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });

  const pw = await hashPassword('Password@123');

  const admin = await User.create({
    name: 'Admin Test',
    email: 'adm_test@bbdu.ac.in',
    passwordHash: pw,
    role: 'SUPER_ADMIN',
  });
  adminToken = signToken({ userId: admin._id, role: admin.role });

  const student = await User.create({
    name: 'Student Test',
    email: 'std_test@bbdu.ac.in',
    passwordHash: pw,
    role: 'STUDENT',
  });
  studentToken = signToken({ userId: student._id, role: student.role });

  const warden = await User.create({
    name: 'Warden Test',
    email: 'wrd_test@bbdu.ac.in',
    passwordHash: pw,
    role: 'WARDEN',
  });
  wardenToken = signToken({ userId: warden._id, role: warden.role });
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await mongoose.connection.dropDatabase();
  await disconnectDB();
});

test('Dashboard stats endpoint returns role-specific stats for SUPER_ADMIN', async () => {
  const res = await fetch(`${baseUrl}/api/dashboard/stats`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, true);
  assert.ok(typeof body.data.totalUsers === 'number');
  assert.ok(typeof body.data.totalStudents === 'number');
  assert.ok(typeof body.data.totalHostels === 'number');
});

test('Dashboard stats endpoint returns role-specific stats for STUDENT', async () => {
  const res = await fetch(`${baseUrl}/api/dashboard/stats`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, true);
  assert.ok(body.data.student);
  assert.equal(body.data.student.email, 'std_test@bbdu.ac.in');
});

test('Hostel CRUD operations by SUPER_ADMIN', async () => {
  // 1. Create
  const createRes = await fetch(`${baseUrl}/api/admin/hostels`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      name: 'Ramanujan Hostel',
      code: 'RH1',
      type: 'BOYS',
      address: 'North Campus',
    }),
  });
  assert.equal(createRes.status, 201);
  const createBody = await createRes.json();
  const hostelId = createBody.data.hostel._id;
  assert.equal(createBody.data.hostel.code, 'RH1');

  // 2. List
  const listRes = await fetch(`${baseUrl}/api/admin/hostels`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(listRes.status, 200);
  const listBody = await listRes.json();
  assert.ok(listBody.data.hostels.some((h) => h.code === 'RH1'));

  // 3. Update
  const updateRes = await fetch(`${baseUrl}/api/admin/hostels/${hostelId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ name: 'Ramanujan Boys Hostel' }),
  });
  assert.equal(updateRes.status, 200);
  const updateBody = await updateRes.json();
  assert.equal(updateBody.data.hostel.name, 'Ramanujan Boys Hostel');

  // 4. Status Toggle
  const toggleRes = await fetch(`${baseUrl}/api/admin/hostels/${hostelId}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(toggleRes.status, 200);
  const toggleBody = await toggleRes.json();
  assert.equal(toggleBody.data.hostel.isActive, false);

  // Re-enable
  await fetch(`${baseUrl}/api/admin/hostels/${hostelId}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
});

test('Block, Floor, and Room CRUD with occupancy validation', async () => {
  const hostel = await Hostel.findOne({ code: 'RH1' });

  // 1. Create Block
  const blockRes = await fetch(`${baseUrl}/api/admin/blocks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      hostelId: String(hostel._id),
      name: 'Block 1',
      code: 'B1',
    }),
  });
  assert.equal(blockRes.status, 201);
  const blockBody = await blockRes.json();
  const blockId = blockBody.data.block._id;

  // 2. Create Floor
  const floorRes = await fetch(`${baseUrl}/api/admin/floors`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      hostelId: String(hostel._id),
      blockId: String(blockId),
      floorNumber: 1,
      name: 'Floor 1',
    }),
  });
  assert.equal(floorRes.status, 201);
  const floorBody = await floorRes.json();
  const floorId = floorBody.data.floor._id;

  // 3. Create Room - Invalid Occupancy (occupancy > capacity)
  const badRoomRes = await fetch(`${baseUrl}/api/admin/rooms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      hostelId: String(hostel._id),
      blockId: String(blockId),
      floorId: String(floorId),
      roomNumber: '101',
      roomType: 'DOUBLE',
      capacity: 2,
      currentOccupancy: 3,
    }),
  });
  assert.equal(badRoomRes.status, 400);

  // 4. Create Room - Valid
  const goodRoomRes = await fetch(`${baseUrl}/api/admin/rooms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      hostelId: String(hostel._id),
      blockId: String(blockId),
      floorId: String(floorId),
      roomNumber: '101',
      roomType: 'DOUBLE',
      capacity: 2,
      currentOccupancy: 1,
    }),
  });
  assert.equal(goodRoomRes.status, 201);
});

test('Department CRUD operations', async () => {
  const res = await fetch(`${baseUrl}/api/admin/departments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      name: 'Electronics & Communication',
      code: 'ECE',
    }),
  });
  assert.equal(res.status, 201);

  const listRes = await fetch(`${baseUrl}/api/admin/departments`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(listRes.status, 200);
  const list = await listRes.json();
  assert.ok(list.data.departments.some((d) => d.code === 'ECE'));
});

test('User CRUD by SUPER_ADMIN: create with initial password, edit, toggle, delete', async () => {
  // 1. Create
  const createRes = await fetch(`${baseUrl}/api/admin/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      name: 'Created User',
      email: 'created@bbdu.ac.in',
      password: 'Password@123',
      role: 'HOSTEL_STAFF',
      employeeId: 'EMP-NEW-99',
    }),
  });
  assert.equal(createRes.status, 201);
  const createBody = await createRes.json();
  const userId = createBody.data.user.id;
  assert.equal('passwordHash' in createBody.data.user, false);

  // 2. Edit
  const editRes = await fetch(`${baseUrl}/api/admin/users/${userId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ name: 'Created User Renamed' }),
  });
  assert.equal(editRes.status, 200);

  // 3. Status toggle
  const toggleRes = await fetch(`${baseUrl}/api/admin/users/${userId}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(toggleRes.status, 200);
  const toggleBody = await toggleRes.json();
  assert.equal(toggleBody.data.user.isActive, false);

  // 4. Delete
  const delRes = await fetch(`${baseUrl}/api/admin/users/${userId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(delRes.status, 200);
});

test('Non-admin (WARDEN, STUDENT) cannot access admin CRUD routes', async () => {
  const res1 = await fetch(`${baseUrl}/api/admin/hostels`, {
    headers: { Authorization: `Bearer ${wardenToken}` },
  });
  assert.equal(res1.status, 403);

  const res2 = await fetch(`${baseUrl}/api/admin/rooms`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert.equal(res2.status, 403);
});
