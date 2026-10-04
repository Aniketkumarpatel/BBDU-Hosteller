/**
 * Offline model tests - no database connection required.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

import { User, Hostel, Block, Floor, Room, Department, models } from '../src/models/index.js';
import { ROLE_VALUES } from '../src/constants/roles.js';

// validateSync() is used on purpose: it checks schema rules without running the
// DB-backed hierarchy hooks (async validate() would need a connection). Mute only
// Mongoose's deprecation notice for it.
const emitWarning = process.emitWarning;
process.emitWarning = (warning, ...rest) =>
  String(warning?.message ?? warning).includes('validateSync') ? undefined : emitWarning.call(process, warning, ...rest);

const oid = () => new mongoose.Types.ObjectId();
const errorsOf = (doc) => Object.keys(doc.validateSync()?.errors ?? {});

test('all six models load and are registered', () => {
  assert.deepEqual(Object.keys(models).sort(), ['Block', 'Department', 'Floor', 'Hostel', 'Room', 'User']);
  for (const name of Object.keys(models)) {
    assert.ok(mongoose.modelNames().includes(name), `${name} registered`);
  }
});

test('roles are exactly the five required values', () => {
  assert.deepEqual(ROLE_VALUES, ['STUDENT', 'WARDEN', 'HOSTEL_STAFF', 'AUTHORITY', 'SUPER_ADMIN']);
});

test('User: valid document passes and defaults apply', () => {
  const u = new User({ name: 'Asha', email: 'ASHA@Example.com ', passwordHash: 'hash' });
  assert.equal(u.validateSync(), undefined);
  assert.equal(u.email, 'asha@example.com');
  assert.equal(u.role, 'STUDENT');
  assert.equal(u.isActive, true);
});

test('User: required fields, role enum, email and phone formats', () => {
  assert.deepEqual(errorsOf(new User({})).sort(), ['email', 'name', 'passwordHash']);
  assert.ok(errorsOf(new User({ name: 'x', email: 'a@b.co', passwordHash: 'h', role: 'ADMIN' })).includes('role'));
  assert.ok(errorsOf(new User({ name: 'x', email: 'not-an-email', passwordHash: 'h' })).includes('email'));
  assert.ok(errorsOf(new User({ name: 'x', email: 'a@b.co', passwordHash: 'h', phone: 'abc' })).includes('phone'));
});

test('User: every defined role is accepted', () => {
  for (const role of ROLE_VALUES) {
    assert.equal(new User({ name: 'x', email: 'a@b.co', passwordHash: 'h', role }).validateSync(), undefined);
  }
});

test('User: passwordHash is never serialised (toJSON / toObject / JSON.stringify)', () => {
  const u = new User({ name: 'x', email: 'a@b.co', passwordHash: 'SECRET-HASH' });
  assert.equal('passwordHash' in u.toJSON(), false);
  assert.equal('passwordHash' in u.toObject(), false);
  assert.equal(JSON.stringify(u).includes('SECRET-HASH'), false);
  assert.equal(JSON.stringify({ user: u }).includes('passwordHash'), false);
  assert.equal(User.schema.path('passwordHash').options.select, false);
});

test('User: can reference hostel/block/floor/room/department ids', () => {
  const u = new User({
    name: 'x', email: 'a@b.co', passwordHash: 'h',
    hostelId: oid(), blockId: oid(), floorId: oid(), roomId: oid(), departmentId: oid(),
  });
  assert.equal(u.validateSync(), undefined);
  assert.equal(User.schema.path('roomId').options.ref, 'Room');
  assert.equal(User.schema.path('departmentId').options.ref, 'Department');
});

test('Hostel: code is uppercased, type validated, required fields enforced', () => {
  const h = new Hostel({ name: 'Boys Hostel 1', code: ' bh1 ', type: 'BOYS' });
  assert.equal(h.validateSync(), undefined);
  assert.equal(h.code, 'BH1');
  assert.ok(errorsOf(new Hostel({ name: 'x', code: 'x', type: 'ALIENS' })).includes('type'));
  assert.deepEqual(errorsOf(new Hostel({})).sort(), ['code', 'name']);
});

test('Department / Block: required fields enforced', () => {
  assert.deepEqual(errorsOf(new Department({})).sort(), ['code', 'name']);
  assert.deepEqual(errorsOf(new Block({})).sort(), ['code', 'hostelId', 'name']);
  assert.equal(new Department({ name: 'Computer Science', code: 'cse' }).code, 'CSE');
});

test('Floor: required fields and integer floorNumber', () => {
  assert.deepEqual(errorsOf(new Floor({})).sort(), ['blockId', 'floorNumber', 'hostelId']);
  assert.ok(errorsOf(new Floor({ hostelId: oid(), blockId: oid(), floorNumber: 1.5 })).includes('floorNumber'));
  assert.ok(errorsOf(new Floor({ hostelId: oid(), blockId: oid(), floorNumber: -1 })).includes('floorNumber'));
  assert.equal(new Floor({ hostelId: oid(), blockId: oid(), floorNumber: 2 }).validateSync(), undefined);
});

const roomBase = () => ({
  hostelId: oid(), blockId: oid(), floorId: oid(), roomNumber: ' a-101 ', roomType: 'DOUBLE',
});

test('Room: valid room, roomNumber normalised, occupancy defaults to 0', () => {
  const r = new Room({ ...roomBase(), capacity: 2 });
  assert.equal(r.validateSync(), undefined);
  assert.equal(r.roomNumber, 'A-101');
  assert.equal(r.currentOccupancy, 0);
});

test('Room: currentOccupancy > capacity is rejected', () => {
  const bad = new Room({ ...roomBase(), capacity: 2, currentOccupancy: 3 });
  const err = bad.validateSync();
  assert.ok(err.errors.currentOccupancy);
  assert.match(err.errors.currentOccupancy.message, /cannot be greater than capacity/);
  // Boundary: equal is allowed.
  assert.equal(new Room({ ...roomBase(), capacity: 2, currentOccupancy: 2 }).validateSync(), undefined);
});

test('Room: lowering capacity below occupancy is rejected', () => {
  const r = new Room({ ...roomBase(), capacity: 4, currentOccupancy: 3 });
  assert.equal(r.validateSync(), undefined);
  r.capacity = 2;
  assert.ok(r.validateSync().errors.capacity);
});

test('Room: other field validation', () => {
  assert.ok(errorsOf(new Room({ ...roomBase(), capacity: 0 })).includes('capacity'));
  assert.ok(errorsOf(new Room({ ...roomBase(), capacity: 2, currentOccupancy: -1 })).includes('currentOccupancy'));
  assert.ok(errorsOf(new Room({ ...roomBase(), capacity: 2, roomType: 'PALACE' })).includes('roomType'));
  assert.ok(errorsOf(new Room({ ...roomBase(), capacity: 2.5 })).includes('capacity'));
});

test('declared unique indexes exist on the schemas', () => {
  const has = (model, fields, unique = true) =>
    model.schema.indexes().some(([f, o]) => JSON.stringify(f) === JSON.stringify(fields) && !!o.unique === unique);
  assert.ok(User.schema.path('email').options.unique);
  assert.ok(Hostel.schema.path('code').options.unique);
  assert.ok(Department.schema.path('code').options.unique);
  assert.ok(Department.schema.path('name').options.unique);
  assert.ok(has(User, { studentId: 1 }));
  assert.ok(has(User, { employeeId: 1 }));
  assert.ok(has(Block, { hostelId: 1, code: 1 }));
  assert.ok(has(Floor, { blockId: 1, floorNumber: 1 }));
  assert.ok(has(Room, { floorId: 1, roomNumber: 1 }));
});
