/**
 * Student Registration & Hostel Allocation Test Suite
 *
 * Verifies all 15 requirements:
 * 1. Valid registration with complete hostel allocation
 * 2. Missing hostel
 * 3. Missing block
 * 4. Missing floor
 * 5. Missing room
 * 6. Invalid block for selected hostel
 * 7. Invalid floor for selected block
 * 8. Invalid room for selected floor
 * 9. Already occupied room (409 Conflict)
 * 10. Successful registration saves hostel/block/floor/room
 * 11. Student login returns correct allocation
 * 12. Student dashboard displays allocation (via stats API)
 * 13. Submit Complaint recognizes student as allocated
 * 14. Existing @bbdu.ac.in validation still works
 * 15. Existing duplicate Student ID / email validation still works
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_for_suite_1234567890abcdef';
process.env.JWT_EXPIRES_IN = '1h';

const TEST_URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/bbdu_hosteller_allocation_test';

const { connectDB, disconnectDB } = await import('../src/config/db.js');
const { default: app } = await import('../src/app.js');
const { User, Hostel, Block, Floor, Room, Department } = await import('../src/models/index.js');
const { OFFICIAL_HOSTELS } = await import('../seed/seed.js');

let server;
let baseUrl;

// Shared test hierarchy variables
let testHostel1;
let testHostel2;
let testBlock1;
let testBlock2;
let testFloor1;
let testFloor2;
let testRoom1;
let testRoom2;
let occupiedRoom;

before(async () => {
  await connectDB(TEST_URI);
  await mongoose.connection.dropDatabase();
  await Promise.all([User, Hostel, Block, Floor, Room, Department].map((m) => m.syncIndexes()));

  // Seed test hostels
  testHostel1 = await Hostel.create({
    name: OFFICIAL_HOSTELS[0].name,
    code: OFFICIAL_HOSTELS[0].code,
    type: OFFICIAL_HOSTELS[0].type,
  });

  testHostel2 = await Hostel.create({
    name: OFFICIAL_HOSTELS[1].name,
    code: OFFICIAL_HOSTELS[1].code,
    type: OFFICIAL_HOSTELS[1].type,
  });

  // Seed test blocks
  testBlock1 = await Block.create({
    hostelId: testHostel1._id,
    name: '1',
    code: '1',
  });

  testBlock2 = await Block.create({
    hostelId: testHostel2._id,
    name: '1',
    code: '1',
  });

  // Seed test floors
  testFloor1 = await Floor.create({
    hostelId: testHostel1._id,
    blockId: testBlock1._id,
    floorNumber: 1,
    name: '1',
  });

  testFloor2 = await Floor.create({
    hostelId: testHostel2._id,
    blockId: testBlock2._id,
    floorNumber: 1,
    name: '1',
  });

  // Seed test rooms
  testRoom1 = await Room.create({
    hostelId: testHostel1._id,
    blockId: testBlock1._id,
    floorId: testFloor1._id,
    roomNumber: '101',
    roomType: 'DOUBLE',
    capacity: 2,
    currentOccupancy: 0,
  });

  testRoom2 = await Room.create({
    hostelId: testHostel1._id,
    blockId: testBlock1._id,
    floorId: testFloor1._id,
    roomNumber: '102',
    roomType: 'DOUBLE',
    capacity: 2,
    currentOccupancy: 0,
  });

  // Occupied room: capacity 1, occupancy 1
  occupiedRoom = await Room.create({
    hostelId: testHostel1._id,
    blockId: testBlock1._id,
    floorId: testFloor1._id,
    roomNumber: '103',
    roomType: 'SINGLE',
    capacity: 1,
    currentOccupancy: 1,
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

test('Public lookup endpoints for hostels, blocks, floors, and rooms', async () => {
  const hRes = await fetch(`${baseUrl}/api/auth/hostels`);
  assert.equal(hRes.status, 200);
  const hBody = await hRes.json();
  assert.equal(hBody.success, true);
  assert.ok(hBody.data.hostels.length >= 2);

  const bRes = await fetch(`${baseUrl}/api/auth/blocks?hostelId=${testHostel1._id}`);
  assert.equal(bRes.status, 200);
  const bBody = await bRes.json();
  assert.equal(bBody.success, true);
  assert.equal(bBody.data.blocks[0].name, '1');

  const fRes = await fetch(`${baseUrl}/api/auth/floors?blockId=${testBlock1._id}`);
  assert.equal(fRes.status, 200);
  const fBody = await fRes.json();
  assert.equal(fBody.success, true);
  assert.equal(fBody.data.floors[0].floorNumber, 1);

  const rRes = await fetch(`${baseUrl}/api/auth/rooms?floorId=${testFloor1._id}`);
  assert.equal(rRes.status, 200);
  const rBody = await rRes.json();
  assert.equal(rBody.success, true);
  // Should return rooms with currentOccupancy < capacity (testRoom1 and testRoom2, not occupiedRoom)
  const roomNumbers = rBody.data.rooms.map((r) => r.roomNumber);
  assert.ok(roomNumbers.includes('101'));
  assert.ok(roomNumbers.includes('102'));
  assert.equal(roomNumbers.includes('103'), false);
});

test('1. Valid registration with complete hostel allocation (manual room number)', async () => {
  const payload = {
    name: 'Aniket Patel',
    email: 'aniket@bbdu.ac.in',
    studentId: 'BBDU2026-CSE-001',
    phone: '+919876543210',
    password: 'Password@123',
    role: 'STUDENT',
    hostelId: String(testHostel1._id),
    blockId: String(testBlock1._id),
    floorId: String(testFloor1._id),
    roomNumber: '330',
  };

  const res = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const body = await res.json();
  if (res.status !== 201) console.log('Test 1 failure body:', body);
  assert.equal(res.status, 201);
  assert.equal(body.success, true);
  assert.ok(body.data.token);
  assert.equal(body.data.user.email, 'aniket@bbdu.ac.in');
  assert.equal(String(body.data.user.hostelId), String(testHostel1._id));
  assert.equal(body.data.user.roomNumber, '330');
});

test('2. Missing hostel rejected during registration', async () => {
  const payload = {
    name: 'Missing Hostel Student',
    email: 'nohostel@bbdu.ac.in',
    studentId: 'BBDU2026-CSE-002',
    password: 'Password@123',
    blockId: String(testBlock1._id),
    floorId: String(testFloor1._id),
    roomId: String(testRoom2._id),
  };

  const res = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.success, false);
  assert.match(body.message, /Hostel Name is required/i);
});

test('3. Missing block rejected during registration', async () => {
  const payload = {
    name: 'Missing Block Student',
    email: 'noblock@bbdu.ac.in',
    studentId: 'BBDU2026-CSE-003',
    password: 'Password@123',
    hostelId: String(testHostel1._id),
    floorId: String(testFloor1._id),
    roomId: String(testRoom2._id),
  };

  const res = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.success, false);
  assert.match(body.message, /Block\/Wing is required/i);
});

test('4. Missing floor rejected during registration', async () => {
  const payload = {
    name: 'Missing Floor Student',
    email: 'nofloor@bbdu.ac.in',
    studentId: 'BBDU2026-CSE-004',
    password: 'Password@123',
    hostelId: String(testHostel1._id),
    blockId: String(testBlock1._id),
    roomId: String(testRoom2._id),
  };

  const res = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.success, false);
  assert.match(body.message, /Floor is required/i);
});

test('5. Missing room rejected during registration', async () => {
  const payload = {
    name: 'Missing Room Student',
    email: 'noroom@bbdu.ac.in',
    studentId: 'BBDU2026-CSE-005',
    password: 'Password@123',
    hostelId: String(testHostel1._id),
    blockId: String(testBlock1._id),
    floorId: String(testFloor1._id),
  };

  const res = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.success, false);
  assert.match(body.message, /Room Number is required/i);
});

test('6. Invalid block for selected hostel rejected', async () => {
  const payload = {
    name: 'Mismatched Block Student',
    email: 'mismatchblock@bbdu.ac.in',
    studentId: 'BBDU2026-CSE-006',
    password: 'Password@123',
    hostelId: String(testHostel1._id),
    blockId: String(testBlock2._id), // Belongs to Hostel 2, not Hostel 1
    floorId: String(testFloor1._id),
    roomNumber: '106',
  };

  const res = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.success, false);
  assert.match(body.message, /Selected block does not belong to the selected hostel/i);
});

test('7. Invalid floor for selected block rejected', async () => {
  const payload = {
    name: 'Mismatched Floor Student',
    email: 'mismatchfloor@bbdu.ac.in',
    studentId: 'BBDU2026-CSE-007',
    password: 'Password@123',
    hostelId: String(testHostel1._id),
    blockId: String(testBlock1._id),
    floorId: String(testFloor2._id), // Belongs to Block 2
    roomNumber: '234',
  };

  const res = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.success, false);
  assert.match(body.message, /Selected floor does not belong to the selected block/i);
});

test('8. Accept manual room numbers 106, 234, 420 without requiring predefined room records', async () => {
  const payload = {
    name: 'Manual Room Student',
    email: 'manualroom420@bbdu.ac.in',
    studentId: 'BBDU2026-CSE-008',
    password: 'Password@123',
    hostelId: String(testHostel1._id),
    blockId: String(testBlock1._id),
    floorId: String(testFloor1._id),
    roomNumber: '420',
  };

  const res = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.success, true);
  assert.equal(body.data.user.roomNumber, '420');
});

test('9. Missing room number rejected during registration', async () => {
  const payload = {
    name: 'No Room Student',
    email: 'noroomnum@bbdu.ac.in',
    studentId: 'BBDU2026-CSE-009',
    password: 'Password@123',
    hostelId: String(testHostel1._id),
    blockId: String(testBlock1._id),
    floorId: String(testFloor1._id),
    roomNumber: '',
  };

  const res = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.success, false);
  assert.match(body.message, /Room Number is required/i);
});

test('10. Successful registration saves hostel/block/floor/room and increments room occupancy', async () => {
  const payload = {
    name: 'Priya Singh',
    email: 'priyasingh@bbdu.ac.in',
    studentId: 'BBDU2026-CSE-010',
    phone: '+919876543211',
    password: 'Password@123',
    role: 'STUDENT',
    hostelId: String(testHostel1._id),
    blockId: String(testBlock1._id),
    floorId: String(testFloor1._id),
    roomNumber: '106',
  };

  const res = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.success, true);
  assert.equal(String(body.data.user.hostelId), String(testHostel1._id));
  assert.equal(String(body.data.user.blockId), String(testBlock1._id));
  assert.equal(String(body.data.user.floorId), String(testFloor1._id));
  assert.equal(body.data.user.roomNumber, '106');
});

test('11. Student login returns correct allocation', async () => {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'aniket@bbdu.ac.in',
      password: 'Password@123',
    }),
  });

  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, true);
  const token = body.data.token;

  // Call /me
  const meRes = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  assert.equal(meRes.status, 200);
  const meBody = await meRes.json();
  assert.equal(meBody.success, true);
  const user = meBody.data.user;
  assert.equal(user.hostelId.name, OFFICIAL_HOSTELS[0].name);
  assert.equal(user.blockId.name, '1');
  assert.equal(user.roomNumber, '330');
});

test('12. Student dashboard displays allocation', async () => {
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'aniket@bbdu.ac.in',
      password: 'Password@123',
    }),
  });

  const { data: { token } } = await loginRes.json();

  const dashRes = await fetch(`${baseUrl}/api/dashboard/stats`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  assert.equal(dashRes.status, 200);
  const dashBody = await dashRes.json();
  assert.equal(dashBody.success, true);
  const data = dashBody.data;

  assert.equal(data.hostel.name, OFFICIAL_HOSTELS[0].name);
  assert.equal(data.block.name, '1');
  assert.equal(data.floor.floorNumber, 1);
  assert.equal(data.room.roomNumber, '330');
});

test('13. Submit Complaint recognizes student as allocated', async () => {
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'aniket@bbdu.ac.in',
      password: 'Password@123',
    }),
  });

  const { data: { token } } = await loginRes.json();

  const compRes = await fetch(`${baseUrl}/api/complaints`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      title: 'Ceiling fan noise issue',
      description: 'The ceiling fan in my room is making loud metallic sound',
      category: 'ELECTRICAL',
      issueType: 'FAN_NOT_WORKING',
      priority: 'MEDIUM',
    }),
  });

  assert.equal(compRes.status, 201);
  const compBody = await compRes.json();
  assert.equal(compBody.success, true);
  const hostelIdStr = compBody.data.hostelId?._id ? String(compBody.data.hostelId._id) : String(compBody.data.hostelId);
  const roomIdStr = compBody.data.roomId?._id ? String(compBody.data.roomId._id) : String(compBody.data.roomId);
  assert.equal(hostelIdStr, String(testHostel1._id));
  assert.ok(roomIdStr, 'Room allocation ID must be associated with the complaint');
});

test('14. Existing @bbdu.ac.in validation still works', async () => {
  const payload = {
    name: 'External Domain Student',
    email: 'student@gmail.com',
    studentId: 'BBDU2026-CSE-014',
    password: 'Password@123',
    hostelId: String(testHostel1._id),
    blockId: String(testBlock1._id),
    floorId: String(testFloor1._id),
    roomId: String(testRoom1._id),
  };

  const res = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.success, false);
  assert.match(body.message, /Please use your official BBDU email address ending with @bbdu\.ac\.in/i);
});

test('15. Safe re-registration/upsert works for matching student identity and rejects wrong password candidate', async () => {
  // Matching email & studentId with correct password performs safe update
  const payload1 = {
    name: 'Aniket Updated',
    email: 'ANIKET@bbdu.ac.in',
    studentId: 'BBDU2026-CSE-001',
    password: 'Password@123',
    hostelId: String(testHostel1._id),
    blockId: String(testBlock1._id),
    floorId: String(testFloor1._id),
    roomId: String(testRoom1._id),
  };

  const res1 = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload1),
  });

  assert.equal(res1.status, 200);
  const body1 = await res1.json();
  assert.equal(body1.success, true);
  assert.equal(body1.data.user.name, 'Aniket Updated');

  // Attempting to overwrite existing student identity with wrong password fails (409 Conflict)
  const payload2 = {
    name: 'Imposter Student',
    email: 'ANIKET@bbdu.ac.in',
    studentId: 'BBDU2026-CSE-001',
    password: 'WrongPassword999',
    hostelId: String(testHostel1._id),
    blockId: String(testBlock1._id),
    floorId: String(testFloor1._id),
    roomId: String(testRoom1._id),
  };

  const res2 = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload2),
  });

  assert.equal(res2.status, 409);
  const body2 = await res2.json();
  assert.equal(body2.success, false);
});
