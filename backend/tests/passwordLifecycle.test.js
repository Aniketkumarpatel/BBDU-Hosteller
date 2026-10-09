/**
 * Password Lifecycle Test Suite (DEC-022, Phase 5 task 5.3a)
 *
 * 1.  Self-service change: success, fresh token, old password dead, new password works
 * 2.  Wrong current password is a 400 (not 401) and is audited
 * 3.  Policy and reuse rejection
 * 4.  Old tokens are revoked after a change
 * 5.  Admin reset: temporary password, no-store, no hash leak, forced change flag
 * 6.  Forced-change gate is enforced by the backend, with a small allow-list
 * 7.  Warden scope: own-hostel students and staff only, never wardens/authority/admin
 * 8.  Non-privileged roles and self-reset are refused
 * 9.  Reset revokes the target's existing sessions
 * 10. Audit trail records events and never contains secrets
 * 11. Admin user form: shared policy, forced change, self-edit refused
 * 12. Temporary password generator always satisfies the policy
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_for_suite_1234567890abcdef';
process.env.JWT_EXPIRES_IN = '1h';

const baseUri = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/bbdu_hosteller_test';
const TEST_URI = baseUri.replace(/\/([^/?]+)(\?.*)?$/, '/$1_pwlife$2');

const { connectDB, disconnectDB } = await import('../src/config/db.js');
const { default: app } = await import('../src/app.js');
const { User, Hostel, SecurityAuditLog } = await import('../src/models/index.js');
const { hashPassword } = await import('../src/utils/password.js');
const { generateTemporaryPassword } = await import('../src/utils/temporaryPassword.js');
const { passwordPolicySchema } = await import('../src/validators/auth.validator.js');

let server;
let baseUrl;
let hostelA;
let hostelB;
const users = {};
const PASSWORD = 'Password@123';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

before(async () => {
  await connectDB(TEST_URI);
  await mongoose.connection.dropDatabase();
  await Promise.all([User, Hostel, SecurityAuditLog].map((m) => m.syncIndexes()));

  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });

  hostelA = await Hostel.create({ name: 'Hostel A PW', code: 'HA-PW', type: 'BOYS', address: 'BBDU Campus' });
  hostelB = await Hostel.create({ name: 'Hostel B PW', code: 'HB-PW', type: 'GIRLS', address: 'BBDU Campus' });

  const passwordHash = await hashPassword(PASSWORD);
  const make = (key, role, extra = {}) =>
    User.create({
      name: `${key} user`,
      email: `${key}_pw@bbdu.ac.in`,
      passwordHash,
      role,
      ...extra,
    }).then((u) => {
      users[key] = u;
    });

  await make('admin', 'SUPER_ADMIN');
  await make('authority', 'AUTHORITY');
  await make('wardenA', 'WARDEN', { hostelId: hostelA._id });
  await make('wardenA2', 'WARDEN', { hostelId: hostelA._id });
  await make('wardenB', 'WARDEN', { hostelId: hostelB._id });
  await make('staffA', 'HOSTEL_STAFF', { hostelId: hostelA._id });
  await make('studentA', 'STUDENT', { hostelId: hostelA._id, studentId: 'STU-PW-A' });
  await make('studentB', 'STUDENT', { hostelId: hostelB._id, studentId: 'STU-PW-B' });
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await disconnectDB();
});

async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, data, headers: res.headers };
}

async function login(key, password = PASSWORD) {
  const res = await api('/api/auth/login', {
    method: 'POST',
    body: { email: users[key].email, password },
  });
  return res;
}

const reset = (actorToken, targetKey) =>
  api(`/api/auth/users/${users[targetKey]._id}/reset-password`, { method: 'POST', token: actorToken });

test('1. Self-service change: fresh token, old password dead, new password works', async () => {
  const first = await login('studentA');
  assert.equal(first.status, 200);
  assert.equal(first.data.data.user.mustChangePassword, false);

  const newPassword = 'Changed@456';
  const res = await api('/api/auth/change-password', {
    method: 'POST',
    token: first.data.data.token,
    body: { currentPassword: PASSWORD, newPassword },
  });
  assert.equal(res.status, 200);
  assert.ok(res.data.data.token);
  assert.equal(res.data.data.user.mustChangePassword, false);
  assert.equal(JSON.stringify(res.data).includes('passwordHash'), false);

  const me = await api('/api/auth/me', { token: res.data.data.token });
  assert.equal(me.status, 200, 'the fresh token returned by change-password must work immediately');

  assert.equal((await login('studentA', PASSWORD)).status, 401, 'old password must stop working');
  assert.equal((await login('studentA', newPassword)).status, 200);

  // Restore for later tests
  const restoreToken = (await login('studentA', newPassword)).data.data.token;
  const back = await api('/api/auth/change-password', {
    method: 'POST',
    token: restoreToken,
    body: { currentPassword: newPassword, newPassword: PASSWORD },
  });
  assert.equal(back.status, 200);
});

test('2. Wrong current password is a 400 (never 401) and is audited', async () => {
  const token = (await login('studentB')).data.data.token;
  const res = await api('/api/auth/change-password', {
    method: 'POST',
    token,
    body: { currentPassword: 'Wrong@12345', newPassword: 'Another@789' },
  });
  assert.equal(res.status, 400, '401 would make the frontend log the user out for a typo');
  assert.match(res.data.message, /current password is incorrect/i);

  const audit = await SecurityAuditLog.countDocuments({
    eventType: 'FAILED_LOGIN',
    actorEmail: users.studentB.email,
    'details.reason': /change-password/,
  });
  assert.equal(audit, 1);
});

test('3. New password must satisfy the policy and differ from the current one', async () => {
  const token = (await login('studentB')).data.data.token;
  const attempt = (newPassword, currentPassword = PASSWORD) =>
    api('/api/auth/change-password', { method: 'POST', token, body: { currentPassword, newPassword } });

  assert.equal((await attempt('short1A')).status, 400, 'too short');
  assert.equal((await attempt('alllowercase123')).status, 400, 'no uppercase');
  assert.equal((await attempt('ALLUPPERCASE123')).status, 400, 'no lowercase');
  assert.equal((await attempt('NoDigitsHere')).status, 400, 'no digit');
  const same = await attempt(PASSWORD);
  assert.equal(same.status, 400);
  assert.match(same.data.message, /different/i);
  assert.equal((await api('/api/auth/change-password', { method: 'POST', token, body: {} })).status, 400);
  assert.equal((await api('/api/auth/change-password', { method: 'POST', body: {} })).status, 401);
});

test('4. Tokens issued before a password change are revoked', async () => {
  const oldToken = (await login('staffA')).data.data.token;
  assert.equal((await api('/api/notifications', { token: oldToken })).status, 200);

  // JWT iat has one-second precision; tokens issued in the same second as the change are
  // tolerated by design, so make sure the change lands in a later second.
  await sleep(1100);

  const res = await api('/api/auth/change-password', {
    method: 'POST',
    token: oldToken,
    body: { currentPassword: PASSWORD, newPassword: 'Staff@Changed1' },
  });
  assert.equal(res.status, 200);

  const revoked = await api('/api/notifications', { token: oldToken });
  assert.equal(revoked.status, 401);
  assert.match(revoked.data.message, /password was changed/i);

  assert.equal((await api('/api/notifications', { token: res.data.data.token })).status, 200);

  // Put the original password back for later tests
  const restore = await api('/api/auth/change-password', {
    method: 'POST',
    token: res.data.data.token,
    body: { currentPassword: 'Staff@Changed1', newPassword: PASSWORD },
  });
  assert.equal(restore.status, 200);
});

test('5. Admin reset returns a one-time temporary password and forces a change', async () => {
  const adminToken = (await login('admin')).data.data.token;
  const res = await reset(adminToken, 'studentB');

  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  const temp = res.data.data.temporaryPassword;
  assert.ok(passwordPolicySchema.safeParse(temp).success, 'temporary password must satisfy the policy');
  assert.equal(res.data.data.user.mustChangePassword, true);
  assert.equal(JSON.stringify(res.data).includes('passwordHash'), false);

  assert.equal((await login('studentB', PASSWORD)).status, 401, 'previous password must be dead');
  const tempLogin = await login('studentB', temp);
  assert.equal(tempLogin.status, 200);
  assert.equal(tempLogin.data.data.user.mustChangePassword, true);

  // Leave studentB in a clean state for later tests
  const fixed = await api('/api/auth/change-password', {
    method: 'POST',
    token: tempLogin.data.data.token,
    body: { currentPassword: temp, newPassword: PASSWORD },
  });
  assert.equal(fixed.status, 200);
});

test('6. Backend enforces the forced-change gate with a small allow-list', async () => {
  const adminToken = (await login('admin')).data.data.token;
  const temp = (await reset(adminToken, 'studentA')).data.data.temporaryPassword;
  const gated = (await login('studentA', temp)).data.data.token;

  const blocked = await api('/api/notifications', { token: gated });
  assert.equal(blocked.status, 403);
  assert.equal(blocked.data.details.code, 'PASSWORD_CHANGE_REQUIRED');

  assert.equal((await api('/api/complaints/my', { token: gated })).status, 403);
  assert.equal((await api('/api/auth/me', { token: gated })).status, 200, 'me must stay reachable');
  assert.equal((await api('/api/auth/logout', { method: 'POST', token: gated })).status, 200);

  const changed = await api('/api/auth/change-password', {
    method: 'POST',
    token: gated,
    body: { currentPassword: temp, newPassword: PASSWORD },
  });
  assert.equal(changed.status, 200);
  assert.equal((await api('/api/notifications', { token: changed.data.data.token })).status, 200, 'gate lifts after the change');
});

test('7. Warden may reset own-hostel students and staff only', async () => {
  const wardenToken = (await login('wardenA')).data.data.token;

  const student = await reset(wardenToken, 'studentA');
  assert.equal(student.status, 200);
  assert.equal(student.data.data.user.mustChangePassword, true);

  const staff = await reset(wardenToken, 'staffA');
  assert.equal(staff.status, 200);

  // Snapshot the refused targets first: earlier tests legitimately touched some of them
  const refusedKeys = ['wardenA2', 'wardenB', 'authority', 'admin', 'studentB'];
  const before = {};
  for (const key of refusedKeys) {
    const doc = await User.findById(users[key]._id).select('+passwordHash');
    before[key] = {
      passwordHash: doc.passwordHash,
      mustChangePassword: doc.mustChangePassword,
      passwordChangedAt: doc.passwordChangedAt ? doc.passwordChangedAt.getTime() : null,
    };
  }

  const otherHostel = await reset(wardenToken, 'studentB');
  assert.equal(otherHostel.status, 403);
  assert.equal(
    await SecurityAuditLog.countDocuments({
      eventType: 'CROSS_HOSTEL_ACCESS_ATTEMPT',
      targetEntityId: String(users.studentB._id),
    }),
    1
  );

  for (const key of ['wardenA2', 'wardenB', 'authority', 'admin']) {
    const res = await reset(wardenToken, key);
    assert.equal(res.status, 403, `warden must not reset ${key}`);
  }
  assert.equal(
    await SecurityAuditLog.countDocuments({ eventType: 'PRIVILEGE_ESCALATION_ATTEMPT', actorEmail: users.wardenA.email }),
    4
  );

  // The refused targets must be completely untouched
  for (const key of refusedKeys) {
    const fresh = await User.findById(users[key]._id).select('+passwordHash');
    assert.equal(fresh.passwordHash, before[key].passwordHash, `${key} password must be unchanged`);
    assert.equal(fresh.mustChangePassword, before[key].mustChangePassword, `${key} must not be flagged`);
    assert.equal(
      fresh.passwordChangedAt ? fresh.passwordChangedAt.getTime() : null,
      before[key].passwordChangedAt,
      `${key} sessions must not be revoked`
    );
  }

  // Restore resettable users
  for (const key of ['studentA', 'staffA']) {
    await User.updateOne(
      { _id: users[key]._id },
      { passwordHash: await hashPassword(PASSWORD), mustChangePassword: false, passwordChangedAt: null }
    );
  }
});

test('8. Students, staff, authority, self-reset, unknown and deactivated targets are refused', async () => {
  const studentToken = (await login('studentA')).data.data.token;
  assert.equal((await reset(studentToken, 'studentB')).status, 403);

  const staffToken = (await login('staffA')).data.data.token;
  assert.equal((await reset(staffToken, 'studentA')).status, 403);

  const authorityToken = (await login('authority')).data.data.token;
  assert.equal((await reset(authorityToken, 'studentA')).status, 403);

  assert.equal((await api(`/api/auth/users/${users.studentA._id}/reset-password`, { method: 'POST' })).status, 401);

  const adminToken = (await login('admin')).data.data.token;
  const self = await reset(adminToken, 'admin');
  assert.equal(self.status, 400);
  assert.match(self.data.message, /Change Password/);

  const unknown = await api(`/api/auth/users/${new mongoose.Types.ObjectId()}/reset-password`, {
    method: 'POST',
    token: adminToken,
  });
  assert.equal(unknown.status, 404);
  assert.equal((await api('/api/auth/users/not-an-id/reset-password', { method: 'POST', token: adminToken })).status, 404);

  await User.updateOne({ _id: users.studentB._id }, { isActive: false });
  const inactive = await reset(adminToken, 'studentB');
  assert.equal(inactive.status, 400);
  await User.updateOne({ _id: users.studentB._id }, { isActive: true });
});

test('9. A reset revokes the target sessions that already exist', async () => {
  const victimToken = (await login('studentA')).data.data.token;
  assert.equal((await api('/api/notifications', { token: victimToken })).status, 200);

  await sleep(1100);
  const adminToken = (await login('admin')).data.data.token;
  const res = await reset(adminToken, 'studentA');
  assert.equal(res.status, 200);

  const revoked = await api('/api/notifications', { token: victimToken });
  assert.equal(revoked.status, 401);

  await User.updateOne(
    { _id: users.studentA._id },
    { passwordHash: await hashPassword(PASSWORD), mustChangePassword: false, passwordChangedAt: null }
  );
});

test('10. Audit trail records the events and never contains secrets', async () => {
  const adminToken = (await login('admin')).data.data.token;
  const res = await reset(adminToken, 'staffA');
  const temp = res.data.data.temporaryPassword;

  const resetEvents = await SecurityAuditLog.find({
    eventType: 'PASSWORD_RESET',
    targetEntityId: String(users.staffA._id),
  }).lean();
  assert.ok(resetEvents.length >= 1);
  assert.equal(resetEvents[resetEvents.length - 1].actorEmail, users.admin.email);

  const changedEvents = await SecurityAuditLog.countDocuments({ eventType: 'PASSWORD_CHANGED' });
  assert.ok(changedEvents >= 1);

  const everything = JSON.stringify(await SecurityAuditLog.find({}).lean());
  assert.equal(everything.includes(temp), false, 'temporary password must never be audited');
  assert.equal(everything.includes(PASSWORD), false);
  assert.equal(/\$2[aby]\$/.test(everything), false, 'no bcrypt hash may be audited');

  await User.updateOne(
    { _id: users.staffA._id },
    { passwordHash: await hashPassword(PASSWORD), mustChangePassword: false, passwordChangedAt: null }
  );
});

test('11. Admin user form: shared policy, forced change, self-edit refused', async () => {
  const adminToken = (await login('admin')).data.data.token;

  const weakCreate = await api('/api/admin/users', {
    method: 'POST',
    token: adminToken,
    body: { name: 'Weak Pw', email: 'weak_pw@bbdu.ac.in', password: 'Abc123', role: 'HOSTEL_STAFF' },
  });
  assert.equal(weakCreate.status, 400);

  const created = await api('/api/admin/users', {
    method: 'POST',
    token: adminToken,
    body: { name: 'Good Pw', email: 'good_pw@bbdu.ac.in', password: 'Initial@123', role: 'HOSTEL_STAFF', hostelId: String(hostelA._id) },
  });
  assert.equal(created.status, 201);
  assert.equal(created.data.data.user.mustChangePassword, true);

  const target = users.studentA._id;
  const weakUpdate = await api(`/api/admin/users/${target}`, { method: 'PUT', token: adminToken, body: { password: 'Abc123' } });
  assert.equal(weakUpdate.status, 400, 'the old 6 character rule must be gone');

  const okUpdate = await api(`/api/admin/users/${target}`, { method: 'PUT', token: adminToken, body: { password: 'Admin@Set99' } });
  assert.equal(okUpdate.status, 200);
  assert.equal(okUpdate.data.data.user.mustChangePassword, true);
  const fresh = await User.findById(target);
  assert.ok(fresh.passwordChangedAt instanceof Date);

  const selfEdit = await api(`/api/admin/users/${users.admin._id}`, { method: 'PUT', token: adminToken, body: { password: 'Admin@Self99' } });
  assert.equal(selfEdit.status, 400);
  assert.match(selfEdit.data.message, /Change Password/);

  const noPasswordEdit = await api(`/api/admin/users/${target}`, { method: 'PUT', token: adminToken, body: { name: 'Renamed' } });
  assert.equal(noPasswordEdit.status, 200);

  await User.updateOne(
    { _id: target },
    { passwordHash: await hashPassword(PASSWORD), mustChangePassword: false, passwordChangedAt: null }
  );
});

test('12. Temporary password generator always satisfies the policy', () => {
  const seen = new Set();
  for (let i = 0; i < 500; i += 1) {
    const pw = generateTemporaryPassword();
    assert.equal(pw.length, 12);
    assert.ok(passwordPolicySchema.safeParse(pw).success, `policy violated by ${pw}`);
    assert.equal(/[0OlI1]/.test(pw), false, 'ambiguous characters must be excluded');
    seen.add(pw);
  }
  assert.equal(seen.size, 500, 'generator must not repeat');

  assert.equal(generateTemporaryPassword(20).length, 20);
  assert.throws(() => generateTemporaryPassword(7), RangeError);
  assert.throws(() => generateTemporaryPassword(129), RangeError);
});

test('13. Warden lists only own-hostel students and staff, search is literal, others refused', async () => {
  const wardenToken = (await login('wardenA')).data.data.token;

  const all = await api('/api/auth/hostel-users', { token: wardenToken });
  assert.equal(all.status, 200);
  // good_pw@ is hostel A staff created by the admin form test (test 11)
  const createdByAdminForm = 'good_pw@bbdu.ac.in';
  const emails = all.data.data.users.map((u) => u.email).sort();
  assert.deepEqual(emails, [createdByAdminForm, users.staffA.email, users.studentA.email].sort());
  assert.equal(all.data.data.total, 3);
  assert.equal(JSON.stringify(all.data).includes('passwordHash'), false);
  for (const u of all.data.data.users) {
    assert.equal(typeof u.mustChangePassword, 'boolean');
    assert.ok(['STUDENT', 'HOSTEL_STAFF'].includes(u.role));
  }

  const byStudentId = await api('/api/auth/hostel-users?search=stu-pw-a', { token: wardenToken });
  assert.equal(byStudentId.data.data.users.length, 1);
  assert.equal(byStudentId.data.data.users[0].email, users.studentA.email);

  const onlyStaff = await api('/api/auth/hostel-users?role=HOSTEL_STAFF', { token: wardenToken });
  assert.deepEqual(
    onlyStaff.data.data.users.map((u) => u.email).sort(),
    [createdByAdminForm, users.staffA.email].sort()
  );
  const rolePivot = await api('/api/auth/hostel-users?role=WARDEN', { token: wardenToken });
  assert.equal(rolePivot.data.data.users.length, 3, 'an out-of-scope role filter must be ignored, not honored');
  assert.equal(rolePivot.data.data.users.some((u) => u.role === 'WARDEN'), false);

  const regexMeta = await api(`/api/auth/hostel-users?search=${encodeURIComponent('.*')}`, { token: wardenToken });
  assert.equal(regexMeta.status, 200);
  assert.equal(regexMeta.data.data.users.length, 0, 'search must be a literal string, not a regular expression');

  const otherWarden = await api('/api/auth/hostel-users', { token: (await login('wardenB')).data.data.token });
  assert.deepEqual(otherWarden.data.data.users.map((u) => u.email), [users.studentB.email]);

  assert.equal((await api('/api/auth/hostel-users', { token: (await login('studentA')).data.data.token })).status, 403);
  assert.equal((await api('/api/auth/hostel-users', { token: (await login('admin')).data.data.token })).status, 403);
  assert.equal((await api('/api/auth/hostel-users')).status, 401);

  await User.updateOne({ _id: users.wardenA._id }, { $unset: { hostelId: 1 } });
  assert.equal((await api('/api/auth/hostel-users', { token: wardenToken })).status, 403, 'warden without a hostel sees nothing');
  await User.updateOne({ _id: users.wardenA._id }, { hostelId: hostelA._id });
});
