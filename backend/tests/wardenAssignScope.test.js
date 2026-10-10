/**
 * Warden assignment scope (DEC-028)
 *
 * A warden may only be offered, and may only assign complaints to, staff of their own
 * hostel. Staff with no hostel set stay selectable (legacy data). Other roles are unchanged.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_for_suite_1234567890abcdef';
process.env.JWT_EXPIRES_IN = '1h';

const baseUri = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/bbdu_hosteller_test';
const TEST_URI = baseUri.replace(/\/([^/?]+)(\?.*)?$/, '/$1_wscope$2');

const { connectDB, disconnectDB } = await import('../src/config/db.js');
const { default: app } = await import('../src/app.js');
const { User, Hostel, Block, Floor, Room, Department, Complaint } = await import('../src/models/index.js');
const { hashPassword } = await import('../src/utils/password.js');
const { signToken } = await import('../src/utils/jwt.js');
const { generateComplaintId } = await import('../src/services/complaint.service.js');

let server;
let baseUrl;
let hostelA;
let hostelB;
let block;
let floor;
let room;
let dept;
const users = {};
const tokens = {};

before(async () => {
  await connectDB(TEST_URI);
  await mongoose.connection.dropDatabase();
  await Promise.all([User, Hostel, Block, Floor, Room, Department, Complaint].map((m) => m.syncIndexes()));

  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });

  hostelA = await Hostel.create({ name: 'Scope Hostel A', code: 'SC-A', type: 'BOYS', address: 'BBDU Campus' });
  hostelB = await Hostel.create({ name: 'Scope Hostel B', code: 'SC-B', type: 'GIRLS', address: 'BBDU Campus' });
  block = await Block.create({ name: 'A', code: 'A', hostelId: hostelA._id });
  floor = await Floor.create({ floorNumber: 1, name: '1st', hostelId: hostelA._id, blockId: block._id });
  room = await Room.create({
    roomNumber: '101',
    hostelId: hostelA._id,
    blockId: block._id,
    floorId: floor._id,
    capacity: 2,
    roomType: 'DOUBLE',
  });
  dept = await Department.create({ name: 'Plumbing Scope', code: 'PLUMB-SC', type: 'MAINTENANCE' });

  const passwordHash = await hashPassword('Password@123');
  const make = async (key, role, extra = {}) => {
    users[key] = await User.create({ name: `${key} user`, email: `${key}_sc@bbdu.ac.in`, passwordHash, role, ...extra });
    tokens[key] = signToken({ userId: users[key]._id, role });
  };
  await make('wardenA', 'WARDEN', { hostelId: hostelA._id });
  await make('admin', 'SUPER_ADMIN');
  await make('staffA', 'HOSTEL_STAFF', { hostelId: hostelA._id, departmentId: dept._id });
  await make('staffB', 'HOSTEL_STAFF', { hostelId: hostelB._id, departmentId: dept._id });
  await make('staffNone', 'HOSTEL_STAFF', { departmentId: dept._id });
  await make('student', 'STUDENT', {
    hostelId: hostelA._id,
    blockId: block._id,
    floorId: floor._id,
    roomId: room._id,
    studentId: 'STU-SC-1',
  });
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await disconnectDB();
});

const api = async (path, { method = 'GET', token, body } = {}) => {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => null) };
};

const triagedComplaint = async () =>
  Complaint.create({
    complaintId: await generateComplaintId(),
    title: 'Scope test complaint',
    description: 'Scope test',
    category: 'PLUMBING',
    issueType: 'WATER_LEAKAGE',
    priority: 'MEDIUM',
    status: 'TRIAGED',
    studentId: users.student._id,
    hostelId: hostelA._id,
    blockId: block._id,
    floorId: floor._id,
    roomId: room._id,
    departmentId: dept._id,
  });

test('1. A warden is offered staff of their own hostel and staff with no hostel, never another hostel', async () => {
  const complaint = await triagedComplaint();
  const res = await api(`/api/complaints/${complaint._id}/eligible-assignees`, { token: tokens.wardenA });
  assert.equal(res.status, 200);
  const emails = res.data.data.map((u) => u.email).sort();
  assert.ok(emails.includes(users.staffA.email));
  assert.ok(emails.includes(users.staffNone.email));
  assert.equal(emails.includes(users.staffB.email), false, 'staff of another hostel must not be listed');
});

test('2. A super admin still sees staff of every hostel', async () => {
  const complaint = await triagedComplaint();
  const res = await api(`/api/complaints/${complaint._id}/eligible-assignees`, { token: tokens.admin });
  assert.equal(res.status, 200);
  const emails = res.data.data.map((u) => u.email);
  for (const key of ['staffA', 'staffB', 'staffNone']) {
    assert.ok(emails.includes(users[key].email), `${key} must be listed for the super admin`);
  }
});

test('3. A warden cannot assign to staff of another hostel, even with a hand-made request', async () => {
  const complaint = await triagedComplaint();
  const res = await api(`/api/complaints/${complaint._id}/assign`, {
    method: 'PATCH',
    token: tokens.wardenA,
    body: { assignedTo: String(users.staffB._id), departmentId: String(dept._id) },
  });
  assert.equal(res.status, 403);
  assert.match(res.data.message, /own hostel/i);
  const fresh = await Complaint.findById(complaint._id);
  assert.equal(fresh.status, 'TRIAGED', 'a refused assignment must change nothing');
  assert.equal(fresh.assignedTo, null);
});

test('4. A warden can assign to own-hostel staff and to staff with no hostel', async () => {
  for (const key of ['staffA', 'staffNone']) {
    const complaint = await triagedComplaint();
    const res = await api(`/api/complaints/${complaint._id}/assign`, {
      method: 'PATCH',
      token: tokens.wardenA,
      body: { assignedTo: String(users[key]._id), departmentId: String(dept._id) },
    });
    assert.equal(res.status, 200, key);
    assert.equal(String((await Complaint.findById(complaint._id)).assignedTo), String(users[key]._id));
  }
});

test('5. A warden cannot reassign to staff of another hostel, but can reassign within the hostel', async () => {
  const complaint = await triagedComplaint();
  const assigned = await api(`/api/complaints/${complaint._id}/assign`, {
    method: 'PATCH',
    token: tokens.wardenA,
    body: { assignedTo: String(users.staffNone._id), departmentId: String(dept._id) },
  });
  assert.equal(assigned.status, 200);

  const refused = await api(`/api/complaints/${complaint._id}/reassign`, {
    method: 'PATCH',
    token: tokens.wardenA,
    body: { assignedTo: String(users.staffB._id), reason: 'Technician is busy' },
  });
  assert.equal(refused.status, 403);
  assert.equal(String((await Complaint.findById(complaint._id)).assignedTo), String(users.staffNone._id));

  const allowed = await api(`/api/complaints/${complaint._id}/reassign`, {
    method: 'PATCH',
    token: tokens.wardenA,
    body: { assignedTo: String(users.staffA._id), reason: 'Technician is busy' },
  });
  assert.equal(allowed.status, 200);
  assert.equal(String((await Complaint.findById(complaint._id)).assignedTo), String(users.staffA._id));
});

test('6. A super admin may still assign across hostels (unchanged behaviour)', async () => {
  const complaint = await triagedComplaint();
  const res = await api(`/api/complaints/${complaint._id}/assign`, {
    method: 'PATCH',
    token: tokens.admin,
    body: { assignedTo: String(users.staffB._id), departmentId: String(dept._id) },
  });
  assert.equal(res.status, 200);
});
