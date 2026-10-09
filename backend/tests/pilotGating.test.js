/**
 * Pilot Gating Test Suite (DEC-020)
 *
 * Proves the backend enforces the pilot boundary from DEC-015:
 * 1. With pilotMode a breached complaint is NOT escalated or reassigned
 * 2. The assigned hostel's warden (and only that warden) is notified of the breach, once
 * 3. Authority and Super Admin receive nothing
 * 4. A control run without pilotMode still escalates (the flag is the only difference)
 * 5. Unassigned complaints near their deadline remind the hostel warden
 * 6. Deferred-module job groups are skipped, work order and student services jobs still run
 * 7. The scheduler entry point reads PILOT_MODE from the environment
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_for_suite_1234567890abcdef';
process.env.JWT_EXPIRES_IN = '1h';
// Read once by config/env.js; used only by the scheduler entry point test (test 7).
// Direct service calls in this file always pass pilotMode explicitly.
process.env.PILOT_MODE = 'true';

const baseUri = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/bbdu_hosteller_test';
const TEST_URI = baseUri.replace(/\/([^/?]+)(\?.*)?$/, '/$1_pilot$2');

const { connectDB, disconnectDB } = await import('../src/config/db.js');
const {
  User,
  Hostel,
  Block,
  Floor,
  Room,
  Department,
  Complaint,
  ComplaintAssignment,
  ComplaintEscalation,
  ComplaintSlaCycle,
  Notification,
} = await import('../src/models/index.js');
const { hashPassword } = await import('../src/utils/password.js');
const { processSlaAndEscalations, PILOT_SKIPPED_JOBS } = await import('../src/services/sla.service.js');
const { generateComplaintId } = await import('../src/services/complaint.service.js');
const { runSlaSchedulerOnce } = await import('../src/scheduler/slaScheduler.js');

let pilotHostel;
let otherHostel;
let block;
let floor;
let room;
let dept;
let wardenA;
let wardenB;
let staff;
let student;
let authority;
let admin;

const MINUTE = 60 * 1000;

before(async () => {
  await connectDB(TEST_URI);
  await mongoose.connection.dropDatabase();
  await Promise.all(
    [
      User,
      Hostel,
      Block,
      Floor,
      Room,
      Department,
      Complaint,
      ComplaintAssignment,
      ComplaintEscalation,
      ComplaintSlaCycle,
      Notification,
    ].map((m) => m.syncIndexes())
  );

  const pw = await hashPassword('Password@123');

  pilotHostel = await Hostel.create({
    name: 'Pilot Hostel Gating',
    code: 'PH-GATE',
    type: 'BOYS',
    address: 'BBDU Campus, Lucknow',
  });
  otherHostel = await Hostel.create({
    name: 'Other Hostel Gating',
    code: 'OH-GATE',
    type: 'GIRLS',
    address: 'BBDU Campus, Lucknow',
  });

  block = await Block.create({ name: 'Block A', code: 'A', hostelId: pilotHostel._id });
  floor = await Floor.create({
    floorNumber: 1,
    name: '1st Floor',
    hostelId: pilotHostel._id,
    blockId: block._id,
  });
  room = await Room.create({
    roomNumber: '101',
    hostelId: pilotHostel._id,
    blockId: block._id,
    floorId: floor._id,
    capacity: 2,
    roomType: 'DOUBLE',
  });

  dept = await Department.create({
    name: 'Electrical Gating Dept',
    code: 'ELEC-GATE',
    type: 'MAINTENANCE',
  });

  admin = await User.create({
    name: 'Admin Gating',
    email: 'admin_gate@bbdu.ac.in',
    passwordHash: pw,
    role: 'SUPER_ADMIN',
  });
  authority = await User.create({
    name: 'Authority Gating',
    email: 'authority_gate@bbdu.ac.in',
    passwordHash: pw,
    role: 'AUTHORITY',
  });
  wardenA = await User.create({
    name: 'Warden Pilot Gating',
    email: 'warden_a_gate@bbdu.ac.in',
    passwordHash: pw,
    role: 'WARDEN',
    hostelId: pilotHostel._id,
  });
  wardenB = await User.create({
    name: 'Warden Other Gating',
    email: 'warden_b_gate@bbdu.ac.in',
    passwordHash: pw,
    role: 'WARDEN',
    hostelId: otherHostel._id,
  });
  staff = await User.create({
    name: 'Staff Gating',
    email: 'staff_gate@bbdu.ac.in',
    passwordHash: pw,
    role: 'HOSTEL_STAFF',
    departmentId: dept._id,
  });
  student = await User.create({
    name: 'Student Gating',
    email: 'student_gate@bbdu.ac.in',
    passwordHash: pw,
    role: 'STUDENT',
    studentId: 'STU-GATE-001',
    hostelId: pilotHostel._id,
    blockId: block._id,
    floorId: floor._id,
    roomId: room._id,
  });
});

after(async () => {
  await disconnectDB();
});

/**
 * Create an ACTIVE-SLA complaint directly in the database. Direct creation keeps the
 * scenarios independent of the HTTP layer, which other suites already cover.
 */
async function createActiveComplaint({ title, assignedTo, dueOffsetMs, startOffsetMs }) {
  const now = Date.now();
  const slaStartedAt = new Date(now + startOffsetMs);
  const slaDueAt = new Date(now + dueOffsetMs);
  const complaint = await Complaint.create({
    complaintId: await generateComplaintId(),
    title,
    description: 'Pilot gating scenario complaint',
    category: 'ELECTRICAL',
    issueType: 'FAN_NOT_WORKING',
    priority: 'HIGH',
    status: assignedTo ? 'ASSIGNED' : 'TRIAGED',
    studentId: student._id,
    hostelId: pilotHostel._id,
    blockId: block._id,
    floorId: floor._id,
    roomId: room._id,
    departmentId: dept._id,
    assignedTo: assignedTo || null,
    slaStatus: 'ACTIVE',
    slaStartedAt,
    slaDueAt,
    reminderSentAt: null,
  });
  await ComplaintSlaCycle.create({
    complaintId: complaint._id,
    cycleNumber: 1,
    escalationLevel: 0,
    slaRuleSnapshot: {
      name: 'Gating Test SLA',
      code: 'GATE-TEST',
      priority: 'HIGH',
      resolutionHours: 24,
      reminderThresholdPercent: 75,
    },
    startedAt: slaStartedAt,
    dueAt: slaDueAt,
    reminderDueAt: new Date(slaStartedAt.getTime() + (slaDueAt.getTime() - slaStartedAt.getTime()) * 0.75),
    status: 'ACTIVE',
  });
  return complaint;
}

const breachedComplaint = (title) =>
  createActiveComplaint({
    title,
    assignedTo: staff._id,
    startOffsetMs: -25 * 60 * MINUTE,
    dueOffsetMs: -15 * MINUTE,
  });

const notificationsFor = (recipientId, complaintId, type) =>
  Notification.find({
    recipient: recipientId,
    relatedEntityId: complaintId,
    ...(type ? { type } : {}),
  }).lean();

test('1. Pilot mode: breach is recorded but the complaint is NOT escalated or reassigned', async () => {
  const complaint = await breachedComplaint('Pilot breach no escalation');

  const result = await processSlaAndEscalations({ pilotMode: true });

  assert.equal(result.pilotMode, true);
  assert.equal(result.escalationsTriggered, 0);
  assert.ok(result.breachesRecorded >= 1);
  assert.deepEqual(result.pilotSkippedJobs, [...PILOT_SKIPPED_JOBS]);

  const after = await Complaint.findById(complaint._id);
  assert.equal(after.slaStatus, 'BREACHED');
  assert.ok(after.slaBreachedAt instanceof Date);
  assert.equal(String(after.assignedTo), String(staff._id), 'owner must not change');
  assert.equal(after.currentEscalationLevel || 0, 0);
  assert.equal(after.escalationCount || 0, 0);

  assert.equal(await ComplaintEscalation.countDocuments({ complaintId: complaint._id }), 0);
  assert.equal(
    await ComplaintAssignment.countDocuments({ complaintId: complaint._id, assignmentType: 'AUTO_ROUTED' }),
    0
  );

  const cycles = await ComplaintSlaCycle.find({ complaintId: complaint._id });
  assert.equal(cycles.length, 1, 'no new SLA cycle may be started');
  assert.equal(cycles[0].status, 'BREACHED');
  assert.ok(cycles[0].breachedAt instanceof Date);
});

test('2. Pilot mode: only the complaint hostel warden is notified of the breach, exactly once', async () => {
  const complaint = await breachedComplaint('Pilot breach warden notice');

  await processSlaAndEscalations({ pilotMode: true });

  const toWardenA = await notificationsFor(wardenA._id, complaint._id, 'COMPLAINT_SLA_BREACHED');
  assert.equal(toWardenA.length, 1);

  // Cross-hostel privacy: a warden of another hostel must receive nothing
  assert.equal((await notificationsFor(wardenB._id, complaint._id)).length, 0);

  // Idempotency: the breach leaves the ACTIVE set, so a second pass sends nothing more
  await processSlaAndEscalations({ pilotMode: true });
  assert.equal((await notificationsFor(wardenA._id, complaint._id, 'COMPLAINT_SLA_BREACHED')).length, 1);
});

test('3. Pilot mode: Authority and Super Admin receive no notification and no ownership', async () => {
  const complaint = await breachedComplaint('Pilot breach executives untouched');

  await processSlaAndEscalations({ pilotMode: true });

  assert.equal((await notificationsFor(authority._id, complaint._id)).length, 0);
  assert.equal((await notificationsFor(admin._id, complaint._id)).length, 0);
  assert.equal(await Notification.countDocuments({ recipient: authority._id }), 0);
  assert.equal(await Notification.countDocuments({ recipient: admin._id }), 0);

  const after = await Complaint.findById(complaint._id);
  assert.notEqual(String(after.assignedTo), String(authority._id));
});

test('4. Unassigned complaint nearing its deadline reminds the hostel warden once', async () => {
  const complaint = await createActiveComplaint({
    title: 'Unassigned near deadline',
    assignedTo: null,
    startOffsetMs: -80 * MINUTE,
    dueOffsetMs: 20 * MINUTE, // 80 percent elapsed, past the 75 percent reminder threshold
  });

  const result = await processSlaAndEscalations({ pilotMode: true });
  assert.ok(result.remindersRecorded >= 1);

  const warnings = await notificationsFor(wardenA._id, complaint._id, 'COMPLAINT_SLA_WARNING');
  assert.equal(warnings.length, 1);
  assert.equal((await notificationsFor(wardenB._id, complaint._id)).length, 0);
  assert.equal((await notificationsFor(staff._id, complaint._id)).length, 0);

  const after = await Complaint.findById(complaint._id);
  assert.ok(after.reminderSentAt instanceof Date);
  assert.equal(after.slaStatus, 'ACTIVE', 'reminder must not change SLA status');

  await processSlaAndEscalations({ pilotMode: true });
  assert.equal(
    (await notificationsFor(wardenA._id, complaint._id, 'COMPLAINT_SLA_WARNING')).length,
    1,
    'reminder must not repeat'
  );
});

test('5. Pilot mode: deferred-module job groups are skipped, work order and student services still run', async () => {
  const pilotResult = await processSlaAndEscalations({ pilotMode: true });
  for (const key of PILOT_SKIPPED_JOBS) {
    assert.equal(key in pilotResult, false, `${key} must be skipped in pilot mode`);
  }
  assert.ok('studentServicesLifecycle' in pilotResult, 'student services job must still run');

  const fullResult = await processSlaAndEscalations();
  assert.equal(fullResult.pilotMode, undefined, 'default call is not pilot mode');
  for (const key of PILOT_SKIPPED_JOBS) {
    assert.ok(key in fullResult, `${key} must run when pilot mode is off`);
  }
});

test('6. Control: the same breach WITHOUT pilot mode still escalates to the warden', async () => {
  const complaint = await breachedComplaint('Control breach escalates');

  const result = await processSlaAndEscalations(); // default: pilotMode off
  assert.ok(result.escalationsTriggered >= 1);

  const after = await Complaint.findById(complaint._id);
  assert.equal(after.currentEscalationLevel, 1);
  assert.equal(String(after.assignedTo), String(wardenA._id));
  assert.equal(await ComplaintEscalation.countDocuments({ complaintId: complaint._id }), 1);
});

test('7. Scheduler entry point reads PILOT_MODE from the environment', async () => {
  const complaint = await breachedComplaint('Scheduler entry point pilot');

  const result = await runSlaSchedulerOnce();

  assert.equal(result.pilotMode, true);
  assert.equal(result.escalationsTriggered, 0);
  const after = await Complaint.findById(complaint._id);
  assert.equal(after.slaStatus, 'BREACHED');
  assert.equal(String(after.assignedTo), String(staff._id));
  assert.equal(await ComplaintEscalation.countDocuments({ complaintId: complaint._id }), 0);
});
