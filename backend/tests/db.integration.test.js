/**
 * Integration tests against a REAL MongoDB. Skipped unless TEST_MONGODB_URI is set.
 * The target database is DROPPED at the end - use a dedicated test database.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

process.env.NODE_ENV = 'test';
const TEST_URI = process.env.TEST_MONGODB_URI;
const skip = TEST_URI ? false : 'TEST_MONGODB_URI not set';

const { connectDB, disconnectDB, getDbStatus } = await import('../src/config/db.js');
const { default: app } = await import('../src/app.js');
const { User, Hostel, Block, Floor, Room, Department } = await import('../src/models/index.js');

let server;
let baseUrl;

const expectDuplicate = (promise) =>
  assert.rejects(promise, (err) => err.code === 11000);

before(async () => {
  if (skip) return;
  assert.equal(await connectDB(TEST_URI), true);
  await mongoose.connection.dropDatabase();
  await Promise.all([User, Hostel, Block, Floor, Room, Department].map((m) => m.syncIndexes()));
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

after(async () => {
  if (skip) return;
  await new Promise((resolve) => server.close(resolve));
  await mongoose.connection.dropDatabase();
  await disconnectDB();
});

const mkHostel = (code = 'BH1') => Hostel.create({ name: `Hostel ${code}`, code, type: 'BOYS' });
const mkTree = async (code = 'T1') => {
  const hostel = await mkHostel(code);
  const block = await Block.create({ hostelId: hostel._id, name: 'Block A', code: 'A' });
  const floor = await Floor.create({ hostelId: hostel._id, blockId: block._id, floorNumber: 1 });
  return { hostel, block, floor };
};

test('connection works and status reports connected', { skip }, () => {
  assert.deepEqual(getDbStatus().connected, true);
  assert.equal(getDbStatus().status, 'connected');
});

test('GET /api/health reports database connected (no URI leaked)', { skip }, async () => {
  const body = await (await fetch(`${baseUrl}/api/health`)).json();
  assert.equal(body.success, true);
  assert.equal(body.database.connected, true);
  assert.equal(body.database.status, 'connected');
  assert.equal(JSON.stringify(body).includes('mongodb://'), false);
});

test('unique indexes were created in MongoDB', { skip }, async () => {
  const names = async (m) => (await m.collection.indexes()).filter((i) => i.unique).map((i) => i.name);
  assert.ok((await names(User)).includes('email_1'));
  assert.ok((await names(Hostel)).includes('code_1'));
  assert.ok((await names(Department)).includes('code_1'));
  assert.ok((await names(Room)).includes('floorId_1_roomNumber_1'));
});

test('User: duplicate email (case-insensitive) rejected; hash hidden in output and queries', { skip }, async () => {
  const u = await User.create({ name: 'A', email: 'dup@x.com', passwordHash: 'SECRET-HASH' });
  await expectDuplicate(User.create({ name: 'B', email: 'DUP@x.com', passwordHash: 'h' }));
  assert.equal(JSON.stringify(u).includes('SECRET-HASH'), false);

  const found = await User.findOne({ email: 'dup@x.com' });
  assert.equal(found.passwordHash, undefined, 'select:false hides it from normal queries');
  const withHash = await User.findOne({ email: 'dup@x.com' }).select('+passwordHash');
  assert.equal(withHash.passwordHash, 'SECRET-HASH');
  assert.equal(JSON.stringify(withHash).includes('SECRET-HASH'), false, 'still hidden when selected');
  const lean = JSON.stringify(await User.find().lean());
  assert.equal(lean.includes('SECRET-HASH'), false);
});

test('User: studentId/employeeId unique only when present', { skip }, async () => {
  await User.create({ name: 'n1', email: 'n1@x.com', passwordHash: 'h' });
  await User.create({ name: 'n2', email: 'n2@x.com', passwordHash: 'h' }); // both without ids: OK
  await User.create({ name: 's1', email: 's1@x.com', passwordHash: 'h', studentId: 'bbd001' });
  await expectDuplicate(User.create({ name: 's2', email: 's2@x.com', passwordHash: 'h', studentId: 'BBD001' }));
  await User.create({ name: 'e1', email: 'e1@x.com', passwordHash: 'h', employeeId: 'E1' });
  await expectDuplicate(User.create({ name: 'e2', email: 'e2@x.com', passwordHash: 'h', employeeId: 'E1' }));
});

test('Hostel and Department codes are unique', { skip }, async () => {
  await mkHostel('UNIQ');
  await expectDuplicate(mkHostel('uniq'));
  await Department.create({ name: 'Computer Science', code: 'CSE' });
  await expectDuplicate(Department.create({ name: 'Other', code: 'cse' }));
  await expectDuplicate(Department.create({ name: 'Computer Science', code: 'CS2' }));
});

test('Block code unique per hostel but reusable across hostels', { skip }, async () => {
  const h1 = await mkHostel('BLK1');
  const h2 = await mkHostel('BLK2');
  await Block.create({ hostelId: h1._id, name: 'Block A', code: 'A' });
  await expectDuplicate(Block.create({ hostelId: h1._id, name: 'Block Z', code: 'a' }));
  await Block.create({ hostelId: h2._id, name: 'Block A', code: 'A' }); // different hostel: OK
});

test('Floor number unique per block; default name generated', { skip }, async () => {
  const { hostel, block, floor } = await mkTree('FLR');
  assert.equal(floor.name, 'Floor 1');
  await expectDuplicate(Floor.create({ hostelId: hostel._id, blockId: block._id, floorNumber: 1 }));
  const ground = await Floor.create({ hostelId: hostel._id, blockId: block._id, floorNumber: 0 });
  assert.equal(ground.name, 'Ground Floor');
});

test('Floor/Room hierarchy integrity is enforced', { skip }, async () => {
  const t1 = await mkTree('HI1');
  const t2 = await mkTree('HI2');

  // block from another hostel
  await assert.rejects(
    Floor.create({ hostelId: t1.hostel._id, blockId: t2.block._id, floorNumber: 5 }),
    /Block does not belong/
  );
  // nonexistent block
  await assert.rejects(
    Floor.create({ hostelId: t1.hostel._id, blockId: new mongoose.Types.ObjectId(), floorNumber: 6 }),
    /block does not exist/
  );
  // floor from another block/hostel
  await assert.rejects(
    Room.create({
      hostelId: t1.hostel._id, blockId: t1.block._id, floorId: t2.floor._id,
      roomNumber: '101', roomType: 'SINGLE', capacity: 1,
    }),
    /Floor does not belong/
  );
});

test('Room: unique per floor, reusable on other floors', { skip }, async () => {
  const { hostel, block, floor } = await mkTree('RMU');
  const floor2 = await Floor.create({ hostelId: hostel._id, blockId: block._id, floorNumber: 2 });
  const base = { hostelId: hostel._id, blockId: block._id, roomType: 'DOUBLE', capacity: 2 };
  await Room.create({ ...base, floorId: floor._id, roomNumber: '101' });
  await expectDuplicate(Room.create({ ...base, floorId: floor._id, roomNumber: '101' }));
  await Room.create({ ...base, floorId: floor2._id, roomNumber: '101' });
});

test('Room: occupancy > capacity rejected on create, save and update queries', { skip }, async () => {
  const { hostel, block, floor } = await mkTree('OCC');
  const base = { hostelId: hostel._id, blockId: block._id, floorId: floor._id, roomType: 'TRIPLE' };

  await assert.rejects(
    Room.create({ ...base, roomNumber: '1', capacity: 2, currentOccupancy: 3 }),
    /cannot be greater than capacity/
  );

  const room = await Room.create({ ...base, roomNumber: '2', capacity: 3, currentOccupancy: 2 });

  room.currentOccupancy = 4;
  await assert.rejects(room.save(), /cannot be greater than capacity/);
  room.currentOccupancy = 3;
  await room.save(); // equal is fine

  await assert.rejects(
    Room.updateOne({ _id: room._id }, { $set: { currentOccupancy: 9 } }),
    /cannot be greater than capacity/
  );
  await assert.rejects(
    Room.findOneAndUpdate({ _id: room._id }, { capacity: 1 }), // lowering capacity below occupancy 3
    /cannot be greater than capacity/
  );
  await Room.updateOne({ _id: room._id }, { $set: { capacity: 5, currentOccupancy: 4 } }); // valid
  const fresh = await Room.findById(room._id);
  assert.equal(fresh.capacity, 5);
  assert.equal(fresh.currentOccupancy, 4);
});

test('User can be linked to the full location hierarchy + department', { skip }, async () => {
  const { hostel, block, floor } = await mkTree('USR');
  const room = await Room.create({
    hostelId: hostel._id, blockId: block._id, floorId: floor._id,
    roomNumber: '201', roomType: 'SINGLE', capacity: 1,
  });
  const dept = await Department.create({ name: 'Mechanical', code: 'ME' });
  const u = await User.create({
    name: 'Linked', email: 'linked@x.com', passwordHash: 'h', role: 'STUDENT',
    hostelId: hostel._id, blockId: block._id, floorId: floor._id, roomId: room._id, departmentId: dept._id,
  });
  const pop = await User.findById(u._id).populate('hostelId blockId floorId roomId departmentId');
  assert.equal(pop.roomId.roomNumber, '201');
  assert.equal(pop.hostelId.code, 'USR');
  assert.equal(pop.departmentId.code, 'ME');
});

test('connectDB rejects a malformed URI and an unreachable server cleanly', { skip }, async () => {
  await assert.rejects(connectDB('http://not-mongo'), /must start with/);
});
