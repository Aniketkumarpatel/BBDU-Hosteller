/**
 * Notification context (DEC-030)
 *
 * Complaint notifications carry the room, block and title of the complaint so the screens
 * can show plain-language text. Uses the service directly (no HTTP app needed).
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_for_suite_1234567890abcdef';
process.env.JWT_EXPIRES_IN = '1h';

const baseUri = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/bbdu_hosteller_test';
const TEST_URI = baseUri.replace(/\/([^/?]+)(\?.*)?$/, '/$1_notifctx$2');

const { connectDB, disconnectDB } = await import('../src/config/db.js');
const { User, Hostel, Block, Floor, Room, Complaint, Notification } = await import('../src/models/index.js');
const { createNotification } = await import('../src/services/notification.service.js');
const { generateComplaintId } = await import('../src/services/complaint.service.js');

let recipient;
let complaint;
let bareComplaint;

before(async () => {
  await connectDB(TEST_URI);
  await mongoose.connection.dropDatabase();
  await Promise.all([User, Hostel, Block, Floor, Room, Complaint, Notification].map((m) => m.syncIndexes()));

  const hostel = await Hostel.create({ name: 'Ctx Hostel', code: 'CTX', type: 'BOYS', address: 'BBDU Campus' });
  const block = await Block.create({ name: 'Wing 1', code: 'W1', hostelId: hostel._id });
  const floor = await Floor.create({ floorNumber: 1, name: '1st', hostelId: hostel._id, blockId: block._id });
  const room = await Room.create({
    roomNumber: '102',
    hostelId: hostel._id,
    blockId: block._id,
    floorId: floor._id,
    capacity: 2,
    roomType: 'DOUBLE',
  });
  recipient = await User.create({ name: 'Ctx Warden', email: 'ctx_warden@bbdu.ac.in', passwordHash: 'x', role: 'WARDEN', hostelId: hostel._id });
  const student = await User.create({
    name: 'Ctx Student',
    email: 'ctx_student@bbdu.ac.in',
    passwordHash: 'x',
    role: 'STUDENT',
    studentId: 'STU-CTX-1',
    hostelId: hostel._id,
    blockId: block._id,
    floorId: floor._id,
    roomId: room._id,
  });
  complaint = await Complaint.create({
    complaintId: await generateComplaintId(),
    title: 'Tap leaking in bathroom',
    description: 'Water drips from the tap all night.',
    category: 'PLUMBING',
    issueType: 'WATER_LEAKAGE',
    priority: 'HIGH',
    status: 'SUBMITTED',
    studentId: student._id,
    hostelId: hostel._id,
    blockId: block._id,
    floorId: floor._id,
    roomId: room._id,
  });
  bareComplaint = complaint;
});

after(async () => {
  await disconnectDB();
});

test('1. A complaint notification gets the room, block and title in its metadata', async () => {
  const n = await createNotification({
    recipient: recipient._id,
    type: 'COMPLAINT_SUBMITTED',
    title: 'New complaint',
    message: 'A new complaint was submitted.',
    relatedEntityType: 'COMPLAINT',
    relatedEntityId: complaint._id,
    metadata: { complaintId: complaint.complaintId, priority: 'HIGH' },
  });
  assert.equal(n.metadata.room, '102');
  assert.equal(n.metadata.block, 'Wing 1');
  assert.equal(n.metadata.title, 'Tap leaking in bathroom');
  assert.equal(n.metadata.complaintId, complaint.complaintId, 'existing metadata must be kept');
  assert.equal(n.metadata.priority, 'HIGH');
});

test('2. Values the caller already set win over the looked-up ones', async () => {
  const n = await createNotification({
    recipient: recipient._id,
    type: 'COMPLAINT_SLA_WARNING',
    title: 'Deadline close',
    message: 'The deadline is close.',
    relatedEntityType: 'COMPLAINT',
    relatedEntityId: complaint._id,
    metadata: { room: 'Custom room' },
  });
  assert.equal(n.metadata.room, 'Custom room');
  assert.equal(n.metadata.title, 'Tap leaking in bathroom');
});

test('3. A missing complaint or a notification without one is created unchanged', async () => {
  const ghost = new mongoose.Types.ObjectId();
  const missing = await createNotification({
    recipient: recipient._id,
    type: 'COMPLAINT_ASSIGNED',
    title: 'Assigned',
    message: 'Assigned to you.',
    relatedEntityType: 'COMPLAINT',
    relatedEntityId: ghost,
    metadata: { complaintId: 'CMP-GHOST' },
  });
  assert.deepEqual({ ...missing.metadata }, { complaintId: 'CMP-GHOST' });

  const noEntity = await createNotification({
    recipient: recipient._id,
    type: 'COMPLAINT_ASSIGNED',
    title: 'No entity',
    message: 'No related complaint.',
    metadata: { note: 'x' },
  });
  assert.deepEqual({ ...noEntity.metadata }, { note: 'x' });
});

test('4. Non-complaint notifications are not given complaint context', async () => {
  const n = await createNotification({
    recipient: recipient._id,
    type: 'MESS_MENU_PUBLISHED',
    title: 'Menu published',
    message: 'The weekly menu is out.',
    relatedEntityType: 'MESS',
    relatedEntityId: complaint._id,
    metadata: { menuId: 'm1' },
  });
  assert.ok(n, 'the notification must be created');
  assert.equal(n.metadata.room, undefined);
  assert.equal(n.metadata.title, undefined);
  assert.deepEqual({ ...n.metadata }, { menuId: 'm1' });
});

test('5. Duplicate notifications inside 10 seconds are still suppressed', async () => {
  const input = {
    recipient: recipient._id,
    type: 'COMPLAINT_REOPENED',
    title: 'Reopened',
    message: 'The student says it is not fixed.',
    relatedEntityType: 'COMPLAINT',
    relatedEntityId: bareComplaint._id,
    metadata: {},
  };
  const first = await createNotification(input);
  const second = await createNotification(input);
  assert.equal(String(first._id), String(second._id));
  assert.equal(await Notification.countDocuments({ type: 'COMPLAINT_REOPENED', recipient: recipient._id }), 1);
});
