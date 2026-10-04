import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_for_suite_1234567890abcdef';
process.env.JWT_EXPIRES_IN = '1h';

const baseUri = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/bbdu_hosteller_test';
const TEST_URI = baseUri.replace(/\/([^/?]+)(\?.*)?$/, '/$1_complaint$2');

const { connectDB, disconnectDB } = await import('../src/config/db.js');
const { default: app } = await import('../src/app.js');
const {
  User,
  Hostel,
  Block,
  Floor,
  Room,
  Department,
  Complaint,
  ComplaintAssignment,
  ComplaintResolution,
  Counter,
} = await import('../src/models/index.js');
const { hashPassword } = await import('../src/utils/password.js');
const { signToken } = await import('../src/utils/jwt.js');
const { ROLES } = await import('../src/constants/roles.js');
const { COMPLAINT_STATUSES } = await import('../src/constants/complaint.constants.js');

let server;
let baseUrl;
let student1Token;
let student1Id;
let student2Token;
let student2Id;
let wardenToken;
let wardenUser;
let staff1Token;
let staff1User;
let staff2Token;
let staff2User;
let inactiveStaffToken;
let inactiveStaffUser;
let hostelId;
let roomId;
let deptId;
let createdComplaintId;
let createdComplaintObjId;

const jsonHeaders = (token) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

before(async () => {
  await connectDB(TEST_URI);
  await Promise.all([
    User.deleteMany({}),
    Hostel.deleteMany({}),
    Block.deleteMany({}),
    Floor.deleteMany({}),
    Room.deleteMany({}),
    Department.deleteMany({}),
    Complaint.deleteMany({}),
    ComplaintAssignment.deleteMany({}),
    ComplaintResolution.deleteMany({}),
    Counter.deleteMany({}),
  ]);

  // Spin up temporary test HTTP server
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });

  const pwdHash = await hashPassword('Password@123');

  // Create Infrastructure
  const hostel = await Hostel.create({
    name: 'Tagore Boys Hostel',
    code: 'TBH-TEST',
    type: 'BOYS',
  });
  hostelId = hostel._id;

  const block = await Block.create({
    hostelId: hostel._id,
    name: 'Block A',
    code: 'BLK-A',
  });

  const floor = await Floor.create({
    hostelId: hostel._id,
    blockId: block._id,
    floorNumber: 1,
    name: 'First Floor',
  });

  const room = await Room.create({
    hostelId: hostel._id,
    blockId: block._id,
    floorId: floor._id,
    roomNumber: '101',
    roomType: 'DOUBLE',
    capacity: 2,
    currentOccupancy: 2,
  });
  roomId = room._id;

  const dept = await Department.create({
    name: 'Electrical Engineering',
    code: 'ELEC',
  });
  deptId = dept._id;

  // Create Students
  const student1 = await User.create({
    name: 'Student One',
    email: 'student1@bbdu.ac.in',
    passwordHash: pwdHash,
    role: ROLES.STUDENT,
    studentId: 'STU-001',
    hostelId: hostel._id,
    blockId: block._id,
    floorId: floor._id,
    roomId: room._id,
    departmentId: dept._id,
  });
  student1Id = student1._id;
  student1Token = signToken({ userId: student1._id, role: student1.role });

  const student2 = await User.create({
    name: 'Student Two',
    email: 'student2@bbdu.ac.in',
    passwordHash: pwdHash,
    role: ROLES.STUDENT,
    studentId: 'STU-002',
    hostelId: hostel._id,
    blockId: block._id,
    floorId: floor._id,
    roomId: room._id,
    departmentId: dept._id,
  });
  student2Id = student2._id;
  student2Token = signToken({ userId: student2._id, role: student2.role });

  // Create Warden
  wardenUser = await User.create({
    name: 'Warden Test',
    email: 'warden_test@bbdu.ac.in',
    passwordHash: pwdHash,
    role: ROLES.WARDEN,
    employeeId: 'WRD-001',
    hostelId: hostel._id,
  });
  wardenToken = signToken({ userId: wardenUser._id, role: wardenUser.role });

  // Create Staff 1
  staff1User = await User.create({
    name: 'Electrician Ramesh',
    email: 'ramesh.staff@bbdu.ac.in',
    passwordHash: pwdHash,
    role: ROLES.HOSTEL_STAFF,
    employeeId: 'STF-001',
    departmentId: dept._id,
    hostelId: hostel._id,
    isActive: true,
  });
  staff1Token = signToken({ userId: staff1User._id, role: staff1User.role });

  // Create Staff 2
  staff2User = await User.create({
    name: 'Electrician Suresh',
    email: 'suresh.staff@bbdu.ac.in',
    passwordHash: pwdHash,
    role: ROLES.HOSTEL_STAFF,
    employeeId: 'STF-002',
    departmentId: dept._id,
    hostelId: hostel._id,
    isActive: true,
  });
  staff2Token = signToken({ userId: staff2User._id, role: staff2User.role });

  // Create Inactive Staff
  inactiveStaffUser = await User.create({
    name: 'Inactive Staff',
    email: 'inactive.staff@bbdu.ac.in',
    passwordHash: pwdHash,
    role: ROLES.HOSTEL_STAFF,
    employeeId: 'STF-003',
    departmentId: dept._id,
    isActive: false,
  });
  inactiveStaffToken = signToken({ userId: inactiveStaffUser._id, role: inactiveStaffUser.role });
});

after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await Promise.all([
    User.deleteMany({}),
    Hostel.deleteMany({}),
    Block.deleteMany({}),
    Floor.deleteMany({}),
    Room.deleteMany({}),
    Department.deleteMany({}),
    Complaint.deleteMany({}),
    ComplaintAssignment.deleteMany({}),
    ComplaintResolution.deleteMany({}),
    Counter.deleteMany({}),
  ]);
  await disconnectDB();
});

test('1. Complaint Meta endpoint returns categories, issue types, priorities, and statuses', async () => {
  const res = await fetch(`${baseUrl}/api/complaints/meta`, {
    headers: jsonHeaders(student1Token),
  });
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.ok(Array.isArray(body.data.categories));
  assert.ok(body.data.categories.includes('ELECTRICAL'));
  assert.ok(body.data.priorities.includes('HIGH'));
  assert.ok(body.data.statuses.includes('SUBMITTED'));
});

test('2. Student successfully submits a complaint (SUBMITTED status)', async () => {
  const payload = {
    title: 'Ceiling Fan Not Working',
    description: 'The ceiling fan in room 101 makes buzzing noise and does not rotate properly.',
    category: 'ELECTRICAL',
    issueType: 'FAN_NOT_WORKING',
    priority: 'HIGH',
    locationDescription: 'Above the study table',
  };

  const res = await fetch(`${baseUrl}/api/complaints`, {
    method: 'POST',
    headers: jsonHeaders(student1Token),
    body: JSON.stringify(payload),
  });
  const body = await res.json();

  assert.equal(res.status, 201);
  assert.equal(body.success, true);
  assert.ok(body.data.complaintId);
  assert.match(body.data.complaintId, /^CMP-\d{4}-\d{5}$/);
  assert.equal(body.data.status, COMPLAINT_STATUSES.SUBMITTED);
  assert.equal(body.data.priority, 'HIGH');
  assert.equal(String(body.data.studentId), String(student1Id));
  assert.equal(String(body.data.hostelId._id || body.data.hostelId), String(hostelId));
  assert.equal(String(body.data.roomId._id || body.data.roomId), String(roomId));

  createdComplaintId = body.data.complaintId;
  createdComplaintObjId = body.data._id;
});

test('3. Warden lists complaints for their hostel and sees the submitted ticket', async () => {
  const res = await fetch(`${baseUrl}/api/complaints`, {
    headers: jsonHeaders(wardenToken),
  });
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.ok(body.data.length >= 1);
  const found = body.data.find((c) => c.complaintId === createdComplaintId);
  assert.ok(found);
  assert.equal(found.status, COMPLAINT_STATUSES.SUBMITTED);
});

test('4. Warden triages the complaint (SUBMITTED -> TRIAGED)', async () => {
  const res = await fetch(`${baseUrl}/api/complaints/${createdComplaintId}/triage`, {
    method: 'PATCH',
    headers: jsonHeaders(wardenToken),
    body: JSON.stringify({
      category: 'ELECTRICAL',
      issueType: 'FAN_NOT_WORKING',
      priority: 'CRITICAL',
      departmentId: deptId,
      triageNote: 'Verified with student. Fan capacitor burnt out. Urgent repair required.',
    }),
  });
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.status, COMPLAINT_STATUSES.TRIAGED);
  assert.equal(body.data.priority, 'CRITICAL');
  assert.equal(body.data.triageNote, 'Verified with student. Fan capacitor burnt out. Urgent repair required.');
  assert.ok(body.data.triagedAt);
});

test('5. Trying to triage an already triaged complaint is rejected (Invalid transition)', async () => {
  const res = await fetch(`${baseUrl}/api/complaints/${createdComplaintId}/triage`, {
    method: 'PATCH',
    headers: jsonHeaders(wardenToken),
    body: JSON.stringify({
      triageNote: 'Trying to triage again',
    }),
  });
  const body = await res.json();

  assert.equal(res.status, 400);
  assert.equal(body.success, false);
  assert.match(body.message, /Cannot triage/i);
});

test('6. Fetch eligible assignees returns active staff', async () => {
  const res = await fetch(`${baseUrl}/api/complaints/${createdComplaintId}/eligible-assignees`, {
    headers: jsonHeaders(wardenToken),
  });
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.ok(Array.isArray(body.data));
  // Active staff should be present, inactive staff should be excluded
  const hasRamesh = body.data.some((u) => u.email === 'ramesh.staff@bbdu.ac.in');
  const hasInactive = body.data.some((u) => u.email === 'inactive.staff@bbdu.ac.in');
  assert.ok(hasRamesh);
  assert.equal(hasInactive, false);
});

test('7. Warden assigns complaint to eligible staff (TRIAGED -> ASSIGNED)', async () => {
  const res = await fetch(`${baseUrl}/api/complaints/${createdComplaintId}/assign`, {
    method: 'PATCH',
    headers: jsonHeaders(wardenToken),
    body: JSON.stringify({
      departmentId: deptId,
      assignedTo: staff1User._id,
      reason: 'Assigned to duty electrician for capacitor replacement.',
    }),
  });
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.status, COMPLAINT_STATUSES.ASSIGNED);
  assert.equal(String(body.data.assignedTo._id || body.data.assignedTo), String(staff1User._id));
  assert.ok(body.data.assignedAt);

  // Verify Assignment history was recorded in MongoDB
  const assignments = await ComplaintAssignment.find({ complaintId: createdComplaintObjId });
  assert.equal(assignments.length, 1);
  assert.equal(assignments[0].isCurrent, true);
  assert.equal(String(assignments[0].assignedTo), String(staff1User._id));
});

test('8. Rejects assigning to inactive staff', async () => {
  // First create a new triaged complaint
  const sRes = await fetch(`${baseUrl}/api/complaints`, {
    method: 'POST',
    headers: jsonHeaders(student1Token),
    body: JSON.stringify({
      title: 'Plumbing leak test',
      description: 'Water leak in room corner pipe.',
      category: 'PLUMBING',
      issueType: 'WATER_LEAKAGE',
      priority: 'LOW',
    }),
  });
  const sBody = await sRes.json();
  const cId = sBody.data.complaintId;

  await fetch(`${baseUrl}/api/complaints/${cId}/triage`, {
    method: 'PATCH',
    headers: jsonHeaders(wardenToken),
    body: JSON.stringify({ departmentId: deptId }),
  });

  const res = await fetch(`${baseUrl}/api/complaints/${cId}/assign`, {
    method: 'PATCH',
    headers: jsonHeaders(wardenToken),
    body: JSON.stringify({
      departmentId: deptId,
      assignedTo: inactiveStaffUser._id,
    }),
  });
  const body = await res.json();

  assert.equal(res.status, 400);
  assert.match(body.message, /inactive/i);
});

test('9. Rejects assigning a STUDENT as maintenance staff', async () => {
  const res = await fetch(`${baseUrl}/api/complaints/${createdComplaintId}/reassign`, {
    method: 'PATCH',
    headers: jsonHeaders(wardenToken),
    body: JSON.stringify({
      assignedTo: student2Id,
      reason: 'Attempting invalid student assignment',
    }),
  });
  const body = await res.json();

  assert.equal(res.status, 400);
  assert.match(body.message, /Cannot assign complaints to user with role/i);
});

test('10. Assigned staff acknowledges complaint (ASSIGNED -> ACKNOWLEDGED)', async () => {
  const res = await fetch(`${baseUrl}/api/complaints/${createdComplaintId}/acknowledge`, {
    method: 'PATCH',
    headers: jsonHeaders(staff1Token),
  });
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.status, COMPLAINT_STATUSES.ACKNOWLEDGED);
  assert.ok(body.data.acknowledgedAt);
  assert.equal(String(body.data.acknowledgedBy._id || body.data.acknowledgedBy), String(staff1User._id));

  // Check assignment record has acknowledgedAt
  const currentAss = await ComplaintAssignment.findOne({ complaintId: createdComplaintObjId, isCurrent: true });
  assert.ok(currentAss.acknowledgedAt);
});

test('11. Assigned staff marks work started (ACKNOWLEDGED -> IN_PROGRESS)', async () => {
  const res = await fetch(`${baseUrl}/api/complaints/${createdComplaintId}/start`, {
    method: 'PATCH',
    headers: jsonHeaders(staff1Token),
  });
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.status, COMPLAINT_STATUSES.IN_PROGRESS);
  assert.ok(body.data.startedAt);
});

test('12. Non-assigned staff cannot mark work started', async () => {
  const res = await fetch(`${baseUrl}/api/complaints/${createdComplaintId}/start`, {
    method: 'PATCH',
    headers: jsonHeaders(staff2Token),
  });
  const body = await res.json();

  assert.equal(res.status, 403);
  assert.match(body.message, /Only the assigned staff member/i);
});

test('13. Warden reassigns complaint to Staff 2 with reason (Audit History check)', async () => {
  const res = await fetch(`${baseUrl}/api/complaints/${createdComplaintId}/reassign`, {
    method: 'PATCH',
    headers: jsonHeaders(wardenToken),
    body: JSON.stringify({
      assignedTo: staff2User._id,
      reason: 'Ramesh on emergency duty in Block C; hand over to Suresh.',
    }),
  });
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.status, COMPLAINT_STATUSES.ASSIGNED);
  assert.equal(String(body.data.assignedTo._id || body.data.assignedTo), String(staff2User._id));

  // Verify Audit History
  const history = await ComplaintAssignment.find({ complaintId: createdComplaintObjId }).sort({ assignedAt: 1 });
  assert.equal(history.length, 2);

  // First record (Ramesh) is no longer current
  assert.equal(history[0].isCurrent, false);
  assert.ok(history[0].unassignedAt);
  assert.equal(String(history[0].assignedTo), String(staff1User._id));

  // Second record (Suresh) is now current
  assert.equal(history[1].isCurrent, true);
  assert.equal(String(history[1].assignedTo), String(staff2User._id));
  assert.equal(String(history[1].previousAssignee), String(staff1User._id));
  assert.equal(history[1].reason, 'Ramesh on emergency duty in Block C; hand over to Suresh.');
});

test('14. Assignment history endpoint returns all chronological transitions', async () => {
  const res = await fetch(`${baseUrl}/api/complaints/${createdComplaintId}/assignments`, {
    headers: jsonHeaders(wardenToken),
  });
  const body = await res.json();

  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.count, 2);
  assert.equal(body.data[0].assignedTo.name, 'Electrician Suresh');
  assert.equal(body.data[1].assignedTo.name, 'Electrician Ramesh');
});

test('15. Unauthorized Student cannot triage, assign, or reassign', async () => {
  // Student trying triage
  const tRes = await fetch(`${baseUrl}/api/complaints/${createdComplaintId}/triage`, {
    method: 'PATCH',
    headers: jsonHeaders(student1Token),
    body: JSON.stringify({ priority: 'LOW' }),
  });
  assert.equal(tRes.status, 403);

  // Student trying assign
  const aRes = await fetch(`${baseUrl}/api/complaints/${createdComplaintId}/assign`, {
    method: 'PATCH',
    headers: jsonHeaders(student1Token),
    body: JSON.stringify({ assignedTo: staff1User._id }),
  });
  assert.equal(aRes.status, 403);

  // Student trying reassign
  const rRes = await fetch(`${baseUrl}/api/complaints/${createdComplaintId}/reassign`, {
    method: 'PATCH',
    headers: jsonHeaders(student1Token),
    body: JSON.stringify({ assignedTo: staff2User._id, reason: 'unauthorized' }),
  });
  assert.equal(rRes.status, 403);
});

test('16. Assigned Staff 2 acknowledges and starts work (ASSIGNED -> ACKNOWLEDGED -> IN_PROGRESS)', async () => {
  const ackRes = await fetch(`${baseUrl}/api/complaints/${createdComplaintId}/acknowledge`, {
    method: 'PATCH',
    headers: jsonHeaders(staff2Token),
  });
  const ackBody = await ackRes.json();
  assert.equal(ackRes.status, 200);
  assert.equal(ackBody.data.status, COMPLAINT_STATUSES.ACKNOWLEDGED);

  const startRes = await fetch(`${baseUrl}/api/complaints/${createdComplaintId}/start`, {
    method: 'PATCH',
    headers: jsonHeaders(staff2Token),
  });
  const startBody = await startRes.json();
  assert.equal(startRes.status, 200);
  assert.equal(startBody.data.status, COMPLAINT_STATUSES.IN_PROGRESS);
});

test('17. Validation: Resolution requires a minimum 5-character resolutionNote', async () => {
  const res = await fetch(`${baseUrl}/api/complaints/${createdComplaintId}/resolve`, {
    method: 'PATCH',
    headers: jsonHeaders(staff2Token),
    body: JSON.stringify({ resolutionNote: 'done' }),
  });
  const body = await res.json();
  assert.equal(res.status, 400);
  assert.equal(body.success, false);
});

test('18. Student cannot resolve complaint (Forbidden 403)', async () => {
  const res = await fetch(`${baseUrl}/api/complaints/${createdComplaintId}/resolve`, {
    method: 'PATCH',
    headers: jsonHeaders(student1Token),
    body: JSON.stringify({ resolutionNote: 'Trying to self resolve as student' }),
  });
  assert.equal(res.status, 403);
});

test('19. Non-assigned staff cannot resolve complaint (Forbidden 403)', async () => {
  const res = await fetch(`${baseUrl}/api/complaints/${createdComplaintId}/resolve`, {
    method: 'PATCH',
    headers: jsonHeaders(staff1Token),
    body: JSON.stringify({ resolutionNote: 'Staff 1 trying to resolve Staff 2 task' }),
  });
  assert.equal(res.status, 403);
});

test('20. Assigned staff resolves complaint (IN_PROGRESS -> STUDENT_VERIFICATION)', async () => {
  const res = await fetch(`${baseUrl}/api/complaints/${createdComplaintId}/resolve`, {
    method: 'PATCH',
    headers: jsonHeaders(staff2Token),
    body: JSON.stringify({
      resolutionNote: 'Replaced fan capacitor with a new 2.5mfd capacitor and tested speed regulator.',
    }),
  });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.status, COMPLAINT_STATUSES.STUDENT_VERIFICATION);
  assert.equal(body.data.resolutionNote, 'Replaced fan capacitor with a new 2.5mfd capacitor and tested speed regulator.');
  assert.ok(body.data.resolvedAt);
  assert.ok(body.data.verificationRequestedAt);
  assert.equal(String(body.data.resolvedBy._id || body.data.resolvedBy), String(staff2User._id));

  // Verify ComplaintResolution record was created
  const resolutions = await ComplaintResolution.find({ complaintId: createdComplaintObjId });
  assert.equal(resolutions.length, 1);
  assert.equal(resolutions[0].attemptNumber, 1);
  assert.equal(resolutions[0].resolutionNote, 'Replaced fan capacitor with a new 2.5mfd capacitor and tested speed regulator.');
});

test('21. Non-owner student cannot verify resolution (Forbidden 403)', async () => {
  const res = await fetch(`${baseUrl}/api/complaints/${createdComplaintId}/verify`, {
    method: 'PATCH',
    headers: jsonHeaders(student2Token),
    body: JSON.stringify({ decision: 'ACCEPT', verificationNote: 'Looks ok to me' }),
  });
  assert.equal(res.status, 403);
});

test('22. Student rejects resolution without reason (Rejected 400)', async () => {
  const res = await fetch(`${baseUrl}/api/complaints/${createdComplaintId}/verify`, {
    method: 'PATCH',
    headers: jsonHeaders(student1Token),
    body: JSON.stringify({ decision: 'REJECT' }),
  });
  const body = await res.json();
  assert.equal(res.status, 400);
  assert.match(body.message, /reason.*reopen/i);
});

test('23. Student rejects resolution with reason (STUDENT_VERIFICATION -> REOPENED, reopenCount = 1)', async () => {
  const res = await fetch(`${baseUrl}/api/complaints/${createdComplaintId}/verify`, {
    method: 'PATCH',
    headers: jsonHeaders(student1Token),
    body: JSON.stringify({
      decision: 'REJECT',
      reopenReason: 'Fan starts rotating but still produces loud grinding noise at speed 3 and above.',
    }),
  });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.status, COMPLAINT_STATUSES.REOPENED);
  assert.equal(body.data.reopenCount, 1);
  assert.equal(body.data.reopenReason, 'Fan starts rotating but still produces loud grinding noise at speed 3 and above.');
  assert.ok(body.data.reopenedAt);
  assert.equal(String(body.data.reopenedBy._id || body.data.reopenedBy), String(student1Id));
  // Assigned staff is preserved
  assert.equal(String(body.data.assignedTo._id || body.data.assignedTo), String(staff2User._id));

  // Check ComplaintResolution was updated with rejection
  const resolutions = await ComplaintResolution.find({ complaintId: createdComplaintObjId }).sort({ attemptNumber: 1 });
  assert.equal(resolutions.length, 1);
  assert.equal(resolutions[0].verificationDecision, 'REJECT');
  assert.equal(resolutions[0].reopened, true);
  assert.equal(resolutions[0].reopenReason, 'Fan starts rotating but still produces loud grinding noise at speed 3 and above.');
});

test('24. Assigned staff resumes work on reopened complaint (REOPENED -> IN_PROGRESS)', async () => {
  const res = await fetch(`${baseUrl}/api/complaints/${createdComplaintId}/resume`, {
    method: 'PATCH',
    headers: jsonHeaders(staff2Token),
  });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.status, COMPLAINT_STATUSES.IN_PROGRESS);
  assert.ok(body.data.startedAt);
});

test('25. Assigned staff resolves complaint for attempt 2 (IN_PROGRESS -> STUDENT_VERIFICATION)', async () => {
  const res = await fetch(`${baseUrl}/api/complaints/${createdComplaintId}/resolve`, {
    method: 'PATCH',
    headers: jsonHeaders(staff2Token),
    body: JSON.stringify({
      resolutionNote: 'Replaced defective ball bearing and oiled motor assembly. Tested smoothly at all 5 speeds.',
    }),
  });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.status, COMPLAINT_STATUSES.STUDENT_VERIFICATION);

  // Check 2 ComplaintResolution records exist
  const resolutions = await ComplaintResolution.find({ complaintId: createdComplaintObjId }).sort({ attemptNumber: 1 });
  assert.equal(resolutions.length, 2);
  assert.equal(resolutions[1].attemptNumber, 2);
  assert.equal(resolutions[1].resolutionNote, 'Replaced defective ball bearing and oiled motor assembly. Tested smoothly at all 5 speeds.');
});

test('26. Student accepts resolution (STUDENT_VERIFICATION -> CLOSED)', async () => {
  const res = await fetch(`${baseUrl}/api/complaints/${createdComplaintId}/verify`, {
    method: 'PATCH',
    headers: jsonHeaders(student1Token),
    body: JSON.stringify({
      decision: 'ACCEPT',
      verificationNote: 'Fan runs perfectly silent now. Thank you!',
    }),
  });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.status, COMPLAINT_STATUSES.CLOSED);
  assert.ok(body.data.closedAt);
  assert.ok(body.data.verifiedAt);
  assert.equal(body.data.verificationNote, 'Fan runs perfectly silent now. Thank you!');
  assert.equal(String(body.data.verifiedBy._id || body.data.verifiedBy), String(student1Id));
});

test('27. Resolution history endpoint returns full chronological audit trail', async () => {
  const res = await fetch(`${baseUrl}/api/complaints/${createdComplaintId}/resolutions`, {
    headers: jsonHeaders(student1Token),
  });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.count, 2);
  assert.equal(body.data[0].attemptNumber, 2);
  assert.equal(body.data[0].verificationDecision, 'ACCEPT');
  assert.equal(body.data[1].attemptNumber, 1);
  assert.equal(body.data[1].verificationDecision, 'REJECT');
});

test('28. Closed complaint cannot be modified or re-resolved', async () => {
  const res = await fetch(`${baseUrl}/api/complaints/${createdComplaintId}/resolve`, {
    method: 'PATCH',
    headers: jsonHeaders(staff2Token),
    body: JSON.stringify({ resolutionNote: 'Attempt to resolve closed ticket' }),
  });
  const body = await res.json();
  assert.equal(res.status, 400);
  assert.equal(body.success, false);
  assert.match(body.message, /Cannot resolve complaint in.*status/i);
});

