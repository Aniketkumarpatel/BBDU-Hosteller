/**
 * Virtual visit room media: hostel scope and safe uploads (DEC-034)
 *
 * A Warden may change the media of rooms in their own hostel only, a Super Admin of any room,
 * nobody else. Uploaded files are stored under an extension taken from the checked file type,
 * refused requests leave no files behind, room media can only point at files this server stored,
 * and every stored file is served with a sandboxing policy.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_for_suite_1234567890abcdef';
process.env.JWT_EXPIRES_IN = '1h';

const baseUri = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/bbdu_hosteller_test';
const TEST_URI = baseUri.replace(/\/([^/?]+)(\?.*)?$/, '/$1_vvscope$2');
const photosDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../uploads/rooms/photos');

const { connectDB, disconnectDB } = await import('../src/config/db.js');
const { default: app } = await import('../src/app.js');
const { User, Hostel, Block, Floor, Room } = await import('../src/models/index.js');
const { hashPassword } = await import('../src/utils/password.js');
const { signToken } = await import('../src/utils/jwt.js');

let server;
let baseUrl;
let roomA;
let roomB;
let inactiveRoom;
const tokens = {};
const createdFiles = new Set();

const listPhotos = () => (fs.existsSync(photosDir) ? fs.readdirSync(photosDir) : []);

const api = (method, url, token, body) =>
  fetch(`${baseUrl}${url}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });

const photoForm = (name, type = 'image/png', field = 'photos') => {
  const form = new FormData();
  form.append(field, new Blob(['not really a picture'], { type }), name);
  return form;
};

before(async () => {
  await connectDB(TEST_URI);
  await mongoose.connection.dropDatabase();
  await Promise.all([User, Hostel, Block, Floor, Room].map((m) => m.syncIndexes()));

  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });

  const makeRoom = async (code, extra = {}) => {
    const hostel = await Hostel.create({ name: `VV Hostel ${code}`, code: `VV-${code}`, type: 'BOYS', address: 'BBDU Campus' });
    const block = await Block.create({ name: code, code, hostelId: hostel._id });
    const floor = await Floor.create({ floorNumber: 1, name: '1st', hostelId: hostel._id, blockId: block._id });
    const room = await Room.create({
      roomNumber: `${code}-101`,
      hostelId: hostel._id,
      blockId: block._id,
      floorId: floor._id,
      capacity: 2,
      roomType: 'DOUBLE',
      isVirtualVisitRoom: true,
      ...extra,
    });
    return { hostel, room };
  };

  const a = await makeRoom('A');
  const b = await makeRoom('B');
  const c = await makeRoom('C', { isActive: false });
  roomA = a.room;
  roomB = b.room;
  inactiveRoom = c.room;

  const passwordHash = await hashPassword('Password@123');
  const make = async (key, role, extra = {}) => {
    const user = await User.create({ name: `${key} user`, email: `${key}_vv@bbdu.ac.in`, passwordHash, role, ...extra });
    tokens[key] = signToken({ userId: user._id, role });
  };
  await make('wardenA', 'WARDEN', { hostelId: a.hostel._id });
  await make('wardenC', 'WARDEN', { hostelId: c.hostel._id });
  await make('wardenNone', 'WARDEN');
  await make('admin', 'SUPER_ADMIN');
  await make('student', 'STUDENT', { hostelId: a.hostel._id });
});

after(async () => {
  for (const file of createdFiles) fs.rmSync(path.join(photosDir, file), { force: true });
  if (server) await new Promise((resolve) => server.close(resolve));
  await disconnectDB();
});

test('1. A Warden uploads a photo to a room of their own hostel, stored under a safe extension', async () => {
  // The file is called evil.html but sent as a PNG: the stored name must not keep ".html"
  const res = await api('POST', `/api/virtual-visit/rooms/${roomA._id}/upload`, tokens.wardenA, photoForm('evil.html'));
  assert.equal(res.status, 200);
  const body = await res.json();
  const url = body.data.photos.at(-1);
  assert.match(url, /^\/uploads\/rooms\/photos\/room-photo-[\d-]+\.png$/);
  createdFiles.add(path.basename(url));
  assert.ok(fs.existsSync(path.join(photosDir, path.basename(url))));
});

test('2. Stored files are served with a sandboxing policy and the type of the checked extension', async () => {
  const room = await Room.findById(roomA._id);
  const url = room.photos.at(-1);
  const res = await fetch(`${baseUrl}${url}`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-security-policy') || '', /sandbox/);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.match(res.headers.get('content-type') || '', /image\/png/);
});

test('3. A Warden cannot upload to a room of another hostel, and no file is left behind', async () => {
  const before = listPhotos().length;
  const res = await api('POST', `/api/virtual-visit/rooms/${roomB._id}/upload`, tokens.wardenA, photoForm('x.png'));
  assert.equal(res.status, 403);
  assert.equal(listPhotos().length, before);
  assert.equal((await Room.findById(roomB._id)).photos.length, 0);
});

test('4. A Warden cannot delete or change the media of another hostel room', async () => {
  const del = await api('DELETE', `/api/virtual-visit/rooms/${roomB._id}/media-item`, tokens.wardenA, { type: 'photo', url: '/uploads/rooms/photos/a.png' });
  assert.equal(del.status, 403);
  const patch = await api('PATCH', `/api/virtual-visit/rooms/${roomB._id}/media`, tokens.wardenA, { description: 'Taken over' });
  assert.equal(patch.status, 403);
  assert.notEqual((await Room.findById(roomB._id)).description, 'Taken over');
});

test('5. A Warden can change the description and facilities of an own-hostel room', async () => {
  const res = await api('PATCH', `/api/virtual-visit/rooms/${roomA._id}/media`, tokens.wardenA, {
    description: '  A bright corner room  ',
    facilities: ['Wi-Fi', 'Study desk'],
  });
  assert.equal(res.status, 200);
  const room = await Room.findById(roomA._id);
  assert.equal(room.description, 'A bright corner room');
  assert.deepEqual([...room.facilities], ['Wi-Fi', 'Study desk']);
});

test('6. Room media can only point at files this server stored', async () => {
  for (const bad of ['https://evil.example/pixel.png', 'javascript:alert(1)', '/uploads/complaints/x.png', '/uploads/rooms/photos/../../x.png']) {
    const res = await api('PATCH', `/api/virtual-visit/rooms/${roomA._id}/media`, tokens.wardenA, { photos: [bad] });
    assert.equal(res.status, 400, bad);
  }
  const ok = await api('PATCH', `/api/virtual-visit/rooms/${roomA._id}/media`, tokens.wardenA, { photos: ['/uploads/rooms/photos/room101-1-bed.svg'] });
  assert.equal(ok.status, 200);
});

test('7. Unreasonable description and facility lists are refused', async () => {
  const long = await api('PATCH', `/api/virtual-visit/rooms/${roomA._id}/media`, tokens.wardenA, { description: 'x'.repeat(2001) });
  assert.equal(long.status, 400);
  const many = await api('PATCH', `/api/virtual-visit/rooms/${roomA._id}/media`, tokens.wardenA, { facilities: Array.from({ length: 21 }, (_, i) => `F${i}`) });
  assert.equal(many.status, 400);
});

test('8. A Super Admin can manage a room of any hostel', async () => {
  const res = await api('PATCH', `/api/virtual-visit/rooms/${roomB._id}/media`, tokens.admin, { description: 'Set by admin' });
  assert.equal(res.status, 200);
  assert.equal((await Room.findById(roomB._id)).description, 'Set by admin');
});

test('9. A student and a Warden with no hostel cannot manage room media', async () => {
  const student = await api('PATCH', `/api/virtual-visit/rooms/${roomA._id}/media`, tokens.student, { description: 'Nope' });
  assert.equal(student.status, 403);
  const noHostel = await api('PATCH', `/api/virtual-visit/rooms/${roomA._id}/media`, tokens.wardenNone, { description: 'Nope' });
  assert.equal(noHostel.status, 403);
});

test('10. An inactive room cannot be changed, even by the Warden of its hostel', async () => {
  const res = await api('PATCH', `/api/virtual-visit/rooms/${inactiveRoom._id}/media`, tokens.wardenC, { description: 'Nope' });
  assert.equal(res.status, 404);
});

test('11. A request refused after the upload leaves no file behind', async () => {
  await Room.findByIdAndUpdate(roomA._id, {
    photos: Array.from({ length: 6 }, (_, i) => `/uploads/rooms/photos/room101-${i}-bed.svg`),
  });
  const before = listPhotos().length;
  const res = await api('POST', `/api/virtual-visit/rooms/${roomA._id}/upload`, tokens.wardenA, photoForm('seventh.png'));
  assert.equal(res.status, 400);
  assert.equal(listPhotos().length, before);
});

test('12. The delete endpoint refuses an unknown media type', async () => {
  const res = await api('DELETE', `/api/virtual-visit/rooms/${roomA._id}/media-item`, tokens.wardenA, { type: 'script', url: 'x' });
  assert.equal(res.status, 400);
});
