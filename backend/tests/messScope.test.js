/**
 * Mess scope and privacy (DEC-037)
 *
 * Administrators and the Authority manage every mess. A Warden or technician manages the mess of
 * their own hostel only. A student rates the mess of their own hostel only and never reads other
 * students' feedback. A refused weekly timetable upload leaves no file behind.
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
const TEST_URI = baseUri.replace(/\/([^/?]+)(\?.*)?$/, '/$1_messscope$2');
const menusDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../uploads/menus');

const { connectDB, disconnectDB } = await import('../src/config/db.js');
const { default: app } = await import('../src/app.js');
const { User, Hostel, Mess, MessMenu, MessNotice, MessFeedback } = await import('../src/models/index.js');
const { hashPassword } = await import('../src/utils/password.js');
const { signToken } = await import('../src/utils/jwt.js');

let server;
let baseUrl;
let hostelA;
let hostelB;
let messA;
let messB;
let menuB;
let noticeB;
const tokens = {};

const api = (method, url, token, body) =>
  fetch(`${baseUrl}${url}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });

const listMenuUploads = () => (fs.existsSync(menusDir) ? fs.readdirSync(menusDir) : []);
const today = new Date().toISOString().slice(0, 10);

before(async () => {
  await connectDB(TEST_URI);
  await mongoose.connection.dropDatabase();
  await Promise.all([User, Hostel, Mess, MessMenu, MessNotice, MessFeedback].map((m) => m.syncIndexes()));

  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });

  hostelA = await Hostel.create({ name: 'Mess Hostel A', code: 'MS-A', type: 'BOYS', address: 'BBDU Campus' });
  hostelB = await Hostel.create({ name: 'Mess Hostel B', code: 'MS-B', type: 'GIRLS', address: 'BBDU Campus' });
  messA = await Mess.create({ messId: 'MESS-TEST-A', name: 'Mess A', code: 'MSA', hostelId: hostelA._id });
  messB = await Mess.create({ messId: 'MESS-TEST-B', name: 'Mess B', code: 'MSB', hostelId: hostelB._id });
  const passwordHash = await hashPassword('Password@123');
  const make = async (key, role, extra = {}) => {
    const user = await User.create({ name: `${key} user`, email: `${key}_mscope@bbdu.ac.in`, passwordHash, role, ...extra });
    tokens[key] = signToken({ userId: user._id, role });
    return user;
  };
  const admin = await make('admin', 'SUPER_ADMIN');
  menuB = await MessMenu.create({
    menuId: 'MENU-TEST-B',
    messId: messB._id,
    date: today,
    dayOfWeek: 'MONDAY',
    mealType: 'LUNCH',
    menuItems: [{ name: 'Dal', category: 'Main Course' }],
    isPublished: false,
  });
  noticeB = await MessNotice.create({ noticeId: 'MNOT-TEST-B', messId: messB._id, title: 'B notice', message: 'For hostel B', priority: 'NORMAL', isActive: true, createdBy: admin._id });

  await make('wardenA', 'WARDEN', { hostelId: hostelA._id });
  await make('wardenB', 'WARDEN', { hostelId: hostelB._id });
  await make('wardenNone', 'WARDEN');
  await make('staffA', 'HOSTEL_STAFF', { hostelId: hostelA._id });
  await make('authority', 'AUTHORITY');
  await make('studentA', 'STUDENT', { hostelId: hostelA._id, studentId: 'MS-STU-A', email: 'private.a@bbdu.ac.in' });
  await make('studentB', 'STUDENT', { hostelId: hostelB._id, studentId: 'MS-STU-B' });
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await disconnectDB();
});

const menuBody = (extra = {}) => ({
  date: today,
  dayOfWeek: 'MONDAY',
  mealType: 'BREAKFAST',
  menuItems: [{ name: 'Poha', category: 'Main Course' }],
  isPublished: true,
  ...extra,
});

test('1. A Warden saves a menu for the mess of their own hostel but not for another hostel', async () => {
  const own = await api('POST', `/api/messes/${messA._id}/menus`, tokens.wardenA, menuBody());
  assert.ok([200, 201].includes(own.status), `own mess: ${own.status}`);
  const other = await api('POST', `/api/messes/${messB._id}/menus`, tokens.wardenA, menuBody());
  assert.equal(other.status, 403);
  assert.equal(await MessMenu.countDocuments({ messId: messB._id, mealType: 'BREAKFAST' }), 0);
});

test('2. A technician of a hostel is limited to that hostel too, and a Warden with no hostel manages nothing', async () => {
  assert.equal((await api('POST', `/api/messes/${messB._id}/menus`, tokens.staffA, menuBody())).status, 403);
  assert.equal((await api('POST', `/api/messes/${messA._id}/menus`, tokens.wardenNone, menuBody({ mealType: 'DINNER' }))).status, 403);
});

test('3. Authority and administrators manage the mess of any hostel', async () => {
  for (const who of ['authority', 'admin']) {
    const res = await api('POST', `/api/messes/${messB._id}/menus`, tokens[who], menuBody({ mealType: 'SNACKS' }));
    assert.ok([200, 201].includes(res.status), `${who}: ${res.status}`);
  }
});

test('4. A student cannot change menus at all', async () => {
  assert.equal((await api('POST', `/api/messes/${messA._id}/menus`, tokens.studentA, menuBody({ mealType: 'DINNER' }))).status, 403);
});

test('5. Publishing or hiding a menu needs the mess of your own hostel', async () => {
  assert.equal((await api('PATCH', `/api/messes/menus/${menuB._id}/publish`, tokens.wardenA)).status, 403);
  assert.equal((await api('PATCH', `/api/messes/menus/${menuB._id}/unpublish`, tokens.wardenA)).status, 403);
  assert.equal((await MessMenu.findById(menuB._id)).isPublished, false);
  assert.equal((await api('PATCH', `/api/messes/menus/${menuB._id}/publish`, tokens.wardenB)).status, 200);
  assert.equal((await MessMenu.findById(menuB._id)).isPublished, true);
});

test('6. Notices: a Warden posts and switches off notices for their own hostel only', async () => {
  const own = await api('POST', '/api/mess-notices', tokens.wardenA, { messId: String(messA._id), title: 'Dinner late', message: 'Dinner is at 9 pm today', priority: 'NORMAL' });
  assert.ok([200, 201].includes(own.status), `own notice: ${own.status}`);
  const other = await api('POST', '/api/mess-notices', tokens.wardenA, { messId: String(messB._id), title: 'Hijack', message: 'Not allowed', priority: 'URGENT' });
  assert.equal(other.status, 403);
  assert.equal(await MessNotice.countDocuments({ messId: messB._id, title: 'Hijack' }), 0);
  const toggle = await api('PATCH', `/api/mess-notices/${noticeB._id}/toggle`, tokens.wardenA, { isActive: false });
  assert.equal(toggle.status, 403);
  assert.equal((await MessNotice.findById(noticeB._id)).isActive, true);
});

test('7. A weekly timetable can be published only for the mess of your own hostel', async () => {
  const schedule = { MONDAY: { BREAKFAST: ['Idli', 'Sambar'] } };
  assert.equal((await api('POST', `/api/messes/${messB._id}/timetable/publish`, tokens.wardenA, { schedule })).status, 403);
  assert.equal((await api('POST', `/api/messes/${messA._id}/timetable/publish`, tokens.wardenA, { schedule })).status, 200);
});

test('8. A refused timetable upload leaves no file behind', async () => {
  const before = listMenuUploads().length;
  const form = new FormData();
  form.append('menuFile', new Blob(['not really a picture'], { type: 'image/png' }), 'menu.png');
  const res = await api('POST', `/api/messes/${messB._id}/timetable/upload`, tokens.wardenA, form);
  assert.equal(res.status, 403);
  assert.equal(listMenuUploads().length, before);
});

test('9. A Warden cannot create or rename the mess of another hostel', async () => {
  const create = await api('POST', '/api/messes', tokens.wardenA, { name: 'Second B mess', code: 'MSB2', hostelId: String(hostelB._id) });
  assert.equal(create.status, 403);
  assert.equal(await Mess.countDocuments({ code: 'MSB2' }), 0);
  const rename = await api('PATCH', `/api/messes/${messB._id}`, tokens.wardenA, { name: 'Taken over' });
  assert.equal(rename.status, 403);
  assert.equal((await Mess.findById(messB._id)).name, 'Mess B');
});

test('10. A student rates the mess of their own hostel only', async () => {
  const body = (messId) => ({ messId: String(messId), mealType: 'LUNCH', mealDate: today, rating: 5, foodQuality: 'EXCELLENT', taste: 5, hygiene: 5, quantity: 5, comments: 'Very good lunch' });
  assert.equal((await api('POST', '/api/mess-feedback', tokens.studentA, body(messB._id))).status, 403);
  assert.equal(await MessFeedback.countDocuments({ messId: messB._id }), 0);
  const own = await api('POST', '/api/mess-feedback', tokens.studentA, body(messA._id));
  assert.ok([200, 201].includes(own.status), `own mess: ${own.status}`);
  const again = await api('POST', '/api/mess-feedback', tokens.studentA, body(messA._id));
  assert.equal(again.status, 409);
});

test('11. A student cannot read anyone else\'s feedback, only their own', async () => {
  assert.equal((await api('GET', '/api/mess-feedback', tokens.studentB)).status, 403);
  assert.equal((await api('GET', `/api/mess-feedback?messId=${messA._id}`, tokens.studentB)).status, 403);
  const mine = await api('GET', '/api/mess-feedback/my', tokens.studentA);
  assert.equal(mine.status, 200);
  assert.equal((await mine.json()).data.length, 1);
});

test('12. A Warden reads feedback of their own mess only, without email addresses', async () => {
  const own = await api('GET', `/api/mess-feedback?messId=${messA._id}`, tokens.wardenA);
  assert.equal(own.status, 200);
  const rows = (await own.json()).data;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].studentId.name, 'studentA user');
  assert.equal(rows[0].studentId.studentId, 'MS-STU-A');
  assert.equal(rows[0].studentId.email, undefined);
  assert.equal((await api('GET', `/api/mess-feedback?messId=${messB._id}`, tokens.wardenA)).status, 403);
  const noFilter = await api('GET', '/api/mess-feedback', tokens.wardenB);
  assert.equal(noFilter.status, 200);
  assert.equal((await noFilter.json()).data.length, 0);
  const nobody = await api('GET', '/api/mess-feedback', tokens.wardenNone);
  assert.equal(nobody.status, 200);
  assert.equal((await nobody.json()).data.length, 0);
  const authority = await api('GET', '/api/mess-feedback', tokens.authority);
  assert.equal((await authority.json()).data.length, 1);
});

test('13. The dashboard shows student names only to the people who manage that mess', async () => {
  const asStudent = await api('GET', `/api/messes/dashboard?messId=${messA._id}`, tokens.studentA);
  assert.equal(asStudent.status, 200);
  assert.deepEqual((await asStudent.json()).data.recentFeedbacks, []);
  const asOtherStudent = await api('GET', `/api/messes/dashboard?messId=${messA._id}`, tokens.studentB);
  assert.deepEqual((await asOtherStudent.json()).data.recentFeedbacks, []);
  const asWarden = await api('GET', `/api/messes/dashboard?messId=${messA._id}`, tokens.wardenA);
  const wardenRows = (await asWarden.json()).data.recentFeedbacks;
  assert.equal(wardenRows.length, 1);
  assert.equal(wardenRows[0].studentId.email, undefined);
  const asOtherWarden = await api('GET', `/api/messes/dashboard?messId=${messA._id}`, tokens.wardenB);
  assert.deepEqual((await asOtherWarden.json()).data.recentFeedbacks, []);
});
