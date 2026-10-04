import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_for_suite_1234567890abcdef';
process.env.JWT_EXPIRES_IN = '1h';

const baseUri = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/bbdu_hosteller_test';
const TEST_URI = baseUri.replace(/\/([^/?]+)(\?.*)?$/, '/$1_outpass$2');

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
  Notification,
  Outpass,
  Visitor,
} = await import('../src/models/index.js');
const { hashPassword } = await import('../src/utils/password.js');
const { signToken } = await import('../src/utils/jwt.js');
const { processOverdueOutpasses } = await import('../src/services/outpass.service.js');

let server;
let baseUrl;

let adminToken;
let wardenToken;
let staffToken;
let studentToken;
let otherStudentToken;

let testHostel;
let testBlock;
let testFloor;
let testRoom;
let testDept;

let adminUser;
let wardenUser;
let staffUser;
let studentUser;
let otherStudentUser;

before(async () => {
  await connectDB(TEST_URI);
  await mongoose.connection.dropDatabase();
  await Promise.all([
    User,
    Hostel,
    Block,
    Floor,
    Room,
    Department,
    Complaint,
    Notification,
    Outpass,
    Visitor,
  ].map((m) => m.init()));

  server = app.listen(0);
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}/api`;

  testHostel = await Hostel.create({
    name: 'Tagore Boys Hostel',
    code: 'TBH-OUT-TEST',
    type: 'BOYS',
    totalCapacity: 100,
    currentOccupancy: 0,
  });

  testBlock = await Block.create({
    name: 'Block A',
    code: 'A',
    hostelId: testHostel._id,
  });

  testFloor = await Floor.create({
    floorNumber: 1,
    name: 'Floor 1',
    hostelId: testHostel._id,
    blockId: testBlock._id,
  });

  testRoom = await Room.create({
    roomNumber: '101',
    roomType: 'DOUBLE',
    floorId: testFloor._id,
    blockId: testBlock._id,
    hostelId: testHostel._id,
    capacity: 2,
    currentOccupancy: 1,
  });

  testDept = await Department.create({
    name: 'Campus Security',
    code: 'SECURITY',
    description: 'Hostel gate & campus security operations',
    isActive: true,
  });

  const passwordHash = await hashPassword('Password@123');

  adminUser = await User.create({
    name: 'Super Admin',
    email: 'admin.out@bbdu.ac.in',
    role: 'SUPER_ADMIN',
    passwordHash,
    isActive: true,
  });

  wardenUser = await User.create({
    name: 'Warden Mukherjee',
    email: 'warden.out@bbdu.ac.in',
    role: 'WARDEN',
    hostelId: testHostel._id,
    passwordHash,
    isActive: true,
  });

  staffUser = await User.create({
    name: 'Security Officer Singh',
    email: 'security.out@bbdu.ac.in',
    role: 'HOSTEL_STAFF',
    departmentId: testDept._id,
    passwordHash,
    isActive: true,
  });

  studentUser = await User.create({
    name: 'Rohit Sharma',
    email: 'student.out@bbdu.ac.in',
    role: 'STUDENT',
    studentId: 'STU-OUT-001',
    hostelId: testHostel._id,
    blockId: testBlock._id,
    floorId: testFloor._id,
    roomId: testRoom._id,
    phone: '9876543210',
    passwordHash,
    isActive: true,
  });

  otherStudentUser = await User.create({
    name: 'Vikas Patel',
    email: 'otherstudent.out@bbdu.ac.in',
    role: 'STUDENT',
    studentId: 'STU-OUT-002',
    hostelId: testHostel._id,
    blockId: testBlock._id,
    floorId: testFloor._id,
    roomId: testRoom._id,
    phone: '9876543211',
    passwordHash,
    isActive: true,
  });

  adminToken = signToken({ userId: adminUser._id, role: adminUser.role });
  wardenToken = signToken({ userId: wardenUser._id, role: wardenUser.role });
  staffToken = signToken({ userId: staffUser._id, role: staffUser.role });
  studentToken = signToken({ userId: studentUser._id, role: studentUser.role });
  otherStudentToken = signToken({ userId: otherStudentUser._id, role: otherStudentUser.role });
});

after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await mongoose.connection.dropDatabase();
  await disconnectDB();
});

test('Visitor & Outpass Management Module Suite (Step 12)', async (t) => {
  let createdOutpassId;
  let digitalPassToken;
  let createdVisitorId;

  await t.test('1. Student Outpass Request: Student submits valid outpass request', async () => {
    const departure = new Date(Date.now() + 30 * 60 * 1000); // in 30 mins
    const expectedReturn = new Date(Date.now() + 4 * 60 * 60 * 1000); // in 4 hours

    const res = await fetch(`${baseUrl}/outpass`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        purpose: 'PERSONAL',
        destination: 'Hazratganj Market, Lucknow',
        departureAt: departure.toISOString(),
        expectedReturnAt: expectedReturn.toISOString(),
        emergencyContact: {
          name: 'Sunil Sharma',
          phone: '9876543299',
          relation: 'Father',
        },
        remarks: 'Buying semester stationery supplies',
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.match(body.data.outpassId, /^OUT-\d{4}-\d{5}$/);
    assert.equal(body.data.status, 'PENDING');
    assert.equal(body.data.destination, 'Hazratganj Market, Lucknow');
    createdOutpassId = body.data._id;
  });

  await t.test('2. Request Validation Guard: Reject return time before departure time', async () => {
    const departure = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const invalidReturn = new Date(Date.now() + 1 * 60 * 60 * 1000); // before departure!

    const res = await fetch(`${baseUrl}/outpass`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${otherStudentToken}`,
      },
      body: JSON.stringify({
        purpose: 'COLLEGE_WORK',
        destination: 'Campus Library',
        departureAt: departure.toISOString(),
        expectedReturnAt: invalidReturn.toISOString(),
      }),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.message, /after departure/i);
  });

  await t.test('3. Overlapping Outpass Guard: Student cannot submit second active outpass', async () => {
    const departure = new Date(Date.now() + 30 * 60 * 1000);
    const expectedReturn = new Date(Date.now() + 4 * 60 * 60 * 1000);

    const res = await fetch(`${baseUrl}/outpass`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        purpose: 'MEDICAL',
        destination: 'Hospital',
        departureAt: departure.toISOString(),
        expectedReturnAt: expectedReturn.toISOString(),
      }),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.message, /already have an active or pending outpass/i);
  });

  await t.test('4. Self-Approval & Verification Guard: Student cannot approve own outpass', async () => {
    const res = await fetch(`${baseUrl}/outpass/${createdOutpassId}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({ remarks: 'Self approve' }),
    });

    assert.equal(res.status, 403);
  });

  await t.test('5. Self-Verification Guard: Student cannot self-verify exit', async () => {
    const res = await fetch(`${baseUrl}/outpass/${createdOutpassId}/verify-exit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({ remarks: 'Self exit' }),
    });

    assert.equal(res.status, 403);
  });

  await t.test('6. Warden Review: Warden approves outpass and generates digital pass', async () => {
    const res = await fetch(`${baseUrl}/outpass/${createdOutpassId}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${wardenToken}`,
      },
      body: JSON.stringify({ remarks: 'Permitted. Return by scheduled time.' }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.status, 'APPROVED');
    assert.ok(body.data.approvedAt);
    assert.ok(body.data.digitalPassToken);
    digitalPassToken = body.data.digitalPassToken;
  });

  await t.test('7. Digital Pass: Student views generated digital pass', async () => {
    const res = await fetch(`${baseUrl}/outpass/${createdOutpassId}/digital-pass`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.studentName, 'Rohit Sharma');
    assert.equal(body.data.status, 'APPROVED');
    assert.equal(body.data.verificationToken, digitalPassToken);
  });

  await t.test('8. Token Verification: Gate officer verifies digital pass by QR token', async () => {
    const res = await fetch(`${baseUrl}/outpass/verify-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staffToken}`,
      },
      body: JSON.stringify({ token: digitalPassToken }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.studentName, 'Rohit Sharma');
    assert.equal(body.data.status, 'APPROVED');
  });

  await t.test('9. Gate Exit: Security officer verifies student exit at hostel gate', async () => {
    const res = await fetch(`${baseUrl}/outpass/${createdOutpassId}/verify-exit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staffToken}`,
      },
      body: JSON.stringify({ remarks: 'Checked ID and pass. Student exited Main Gate.' }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.data.status, 'OUTSIDE');
    assert.ok(body.data.actualExitAt);
    assert.equal(body.data.verifiedExitBy, staffUser._id.toString());
  });

  await t.test('10. Central Scheduler: Detects overdue outpass and marks OVERDUE', async () => {
    // Set expectedReturnAt in past to simulate overdue student
    await Outpass.findByIdAndUpdate(createdOutpassId, {
      expectedReturnAt: new Date(Date.now() - 30 * 60 * 1000), // 30 mins ago
    });

    const results = await processOverdueOutpasses(new Date());
    assert.ok(results.checkedCount >= 1);
    assert.ok(results.overdueMarkedCount >= 1);

    const updated = await Outpass.findById(createdOutpassId);
    assert.equal(updated.status, 'OVERDUE');
    assert.ok(updated.overdueNotifiedAt);

    // Idempotency: Running again should NOT re-notify or fail
    const secondPass = await processOverdueOutpasses(new Date());
    assert.equal(secondPass.overdueMarkedCount, 0);
  });

  await t.test('11. Gate Return: Security officer verifies student return to hostel', async () => {
    const res = await fetch(`${baseUrl}/outpass/${createdOutpassId}/verify-return`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staffToken}`,
      },
      body: JSON.stringify({ remarks: 'Returned safely. Note on 30m delay.' }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.data.status, 'RETURN_VERIFIED');
    assert.ok(body.data.actualReturnAt);
    assert.equal(body.data.verifiedReturnBy, staffUser._id.toString());
  });

  await t.test('12. Rejection Flow: Warden rejects an outpass request with reason', async () => {
    // Other student submits request
    const rRes = await fetch(`${baseUrl}/outpass`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${otherStudentToken}`,
      },
      body: JSON.stringify({
        purpose: 'PERSONAL',
        destination: 'Mall',
        departureAt: new Date(Date.now() + 60000).toISOString(),
        expectedReturnAt: new Date(Date.now() + 7200000).toISOString(),
      }),
    });
    const rBody = await rRes.json();
    const otherOutpassId = rBody.data._id;

    // Warden rejects
    const rejRes = await fetch(`${baseUrl}/outpass/${otherOutpassId}/reject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${wardenToken}`,
      },
      body: JSON.stringify({ rejectionReason: 'Parental confirmation required for overnight travel.' }),
    });

    assert.equal(rejRes.status, 200);
    const rejBody = await rejRes.json();
    assert.equal(rejBody.data.status, 'REJECTED');
    assert.equal(rejBody.data.rejectionReason, 'Parental confirmation required for overnight travel.');
  });

  await t.test('13. Visitor Request & Privacy Compliance: Only store last 4 digits of Govt ID', async () => {
    const res = await fetch(`${baseUrl}/outpass/visitors`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        visitorName: 'Mr. Rajesh Sharma',
        phone: '9876543219',
        relationship: 'Uncle',
        purpose: 'Dropping study books and winter wear',
        governmentIdType: 'AADHAAR',
        governmentId: '123456789012', // 12-digit Aadhaar input
        expectedCheckIn: new Date(Date.now() + 3600000).toISOString(),
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.match(body.data.visitorId, /^VIS-\d{4}-\d{5}$/);
    assert.equal(body.data.status, 'REQUESTED');
    // Strict privacy verification:
    assert.equal(body.data.governmentIdLast4, '9012');
    assert.equal(body.data.governmentId, undefined);
    createdVisitorId = body.data._id;
  });

  await t.test('14. Visitor Approval, Check-In, and Check-Out Lifecycle', async () => {
    // 14a: Warden Approves
    const appRes = await fetch(`${baseUrl}/outpass/visitors/${createdVisitorId}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${wardenToken}` },
    });
    assert.equal(appRes.status, 200);
    const appBody = await appRes.json();
    assert.equal(appBody.data.status, 'APPROVED');

    // 14b: Gate Check-in
    const inRes = await fetch(`${baseUrl}/outpass/visitors/${createdVisitorId}/check-in`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staffToken}`,
      },
      body: JSON.stringify({ remarks: 'Guest entered Gate 1. ID verified.' }),
    });
    assert.equal(inRes.status, 200);
    const inBody = await inRes.json();
    assert.equal(inBody.data.status, 'CHECKED_IN');
    assert.ok(inBody.data.actualCheckIn);

    // 14c: Gate Check-out
    const outRes = await fetch(`${baseUrl}/outpass/visitors/${createdVisitorId}/check-out`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staffToken}`,
      },
      body: JSON.stringify({ remarks: 'Guest departed.' }),
    });
    assert.equal(outRes.status, 200);
    const outBody = await outRes.json();
    assert.equal(outBody.data.status, 'CHECKED_OUT');
    assert.ok(outBody.data.actualCheckOut);
  });

  await t.test('15. Operational Dashboard: Stats endpoint returns KPI metrics', async () => {
    const res = await fetch(`${baseUrl}/outpass/dashboard`, {
      headers: { Authorization: `Bearer ${wardenToken}` },
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(typeof body.data.currentlyOutside, 'number');
    assert.equal(typeof body.data.pendingRequests, 'number');
    assert.equal(typeof body.data.overdueOutpasses, 'number');
    assert.equal(typeof body.data.returnsToday, 'number');
    assert.equal(typeof body.data.activeVisitors, 'number');
  });
});
