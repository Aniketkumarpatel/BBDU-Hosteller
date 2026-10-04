import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_for_suite_1234567890abcdef';
process.env.JWT_EXPIRES_IN = '1h';

const baseUri = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/bbdu_hosteller_test';
const TEST_URI = baseUri.replace(/\/([^/?]+)(\?.*)?$/, '/$1_cleaning$2');

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
  CleaningArea,
  CleaningPlan,
  CleaningTask,
} = await import('../src/models/index.js');
const { hashPassword } = await import('../src/utils/password.js');
const { signToken } = await import('../src/utils/jwt.js');
const { processCleaningTasks } = await import('../src/services/cleaning.service.js');

let server;
let baseUrl;

let adminToken;
let wardenToken;
let staffToken;
let studentToken;

let testHostel;
let testBlock;
let testFloor;
let testRoom;
let testDept;

let adminUser;
let wardenUser;
let staffUser;
let studentUser;

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
    CleaningArea,
    CleaningPlan,
    CleaningTask,
  ].map((m) => m.init()));

  server = app.listen(0);
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}/api`;

  testHostel = await Hostel.create({
    name: 'Tagore Boys Hostel',
    code: 'TBH-CLN-TEST',
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
    name: 'Housekeeping & Sanitation',
    code: 'HOUSEKEEPING',
    description: 'Hostel cleaning and sanitation operations',
    isActive: true,
  });

  const passwordHash = await hashPassword('Password@123');

  adminUser = await User.create({
    name: 'Admin Sharma',
    email: 'admin.cln@bbdu.ac.in',
    role: 'SUPER_ADMIN',
    passwordHash,
    isActive: true,
  });

  wardenUser = await User.create({
    name: 'Warden Mukherjee',
    email: 'warden.cln@bbdu.ac.in',
    role: 'WARDEN',
    hostelId: testHostel._id,
    passwordHash,
    isActive: true,
  });

  staffUser = await User.create({
    name: 'Sanitation Worker Raju',
    email: 'staff.cln@bbdu.ac.in',
    role: 'HOSTEL_STAFF',
    departmentId: testDept._id,
    passwordHash,
    isActive: true,
  });

  studentUser = await User.create({
    name: 'Dev Student',
    email: 'student.cln@bbdu.ac.in',
    role: 'STUDENT',
    studentId: 'STU-CLN-001',
    hostelId: testHostel._id,
    blockId: testBlock._id,
    floorId: testFloor._id,
    roomId: testRoom._id,
    passwordHash,
    isActive: true,
  });

  adminToken = signToken({ userId: adminUser._id, role: adminUser.role });
  wardenToken = signToken({ userId: wardenUser._id, role: wardenUser.role });
  staffToken = signToken({ userId: staffUser._id, role: staffUser.role });
  studentToken = signToken({ userId: studentUser._id, role: studentUser.role });
});

after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await mongoose.connection.dropDatabase();
  await disconnectDB();
});

test('Cleaning & Housekeeping Management Module Suite', async (t) => {
  let createdAreaId;
  let createdPlanId;
  let createdTaskId;
  let secondTaskId;

  await t.test('1. Area Management: Warden creates a cleaning area', async () => {
    const res = await fetch(`${baseUrl}/cleaning/areas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${wardenToken}`,
      },
      body: JSON.stringify({
        name: 'Floor 1 Common Washroom',
        areaType: 'WASHROOM',
        hostelId: testHostel._id,
        blockId: testBlock._id,
        floorId: testFloor._id,
        priority: 'HIGH',
        notes: 'East wing main washroom',
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data._id);
    assert.equal(body.data.areaType, 'WASHROOM');
    assert.ok(body.data.customChecklist.length > 0);
    createdAreaId = body.data._id;
  });

  await t.test('2. RBAC Guard: Student cannot create a cleaning area', async () => {
    const res = await fetch(`${baseUrl}/cleaning/areas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        name: 'Unauthorized Area',
        areaType: 'ROOM',
        hostelId: testHostel._id,
      }),
    });

    assert.equal(res.status, 403);
  });

  await t.test('3. Query Areas: Authenticated user fetches area list', async () => {
    const res = await fetch(`${baseUrl}/cleaning/areas?hostelId=${testHostel._id}`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.some((a) => a._id === createdAreaId));
  });

  await t.test('4. Plan Management: Warden creates a recurring daily cleaning plan', async () => {
    const res = await fetch(`${baseUrl}/cleaning/plans`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${wardenToken}`,
      },
      body: JSON.stringify({
        name: 'Daily Washroom Deep Sanitization',
        cleaningAreaId: createdAreaId,
        cleaningType: 'WASHROOM_CLEANING',
        frequency: 'DAILY',
        frequencyInterval: 1,
        frequencyUnit: 'DAYS',
        preferredAssigneeId: staffUser._id,
        estimatedDurationMinutes: 45,
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data.planId.startsWith('CP-'));
    assert.equal(body.data.isActive, true);
    createdPlanId = body.data._id;
  });

  await t.test('5. Task Creation: Warden manually creates a cleaning task', async () => {
    const res = await fetch(`${baseUrl}/cleaning/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${wardenToken}`,
      },
      body: JSON.stringify({
        cleaningAreaId: createdAreaId,
        title: 'Morning Deep Clean',
        cleaningType: 'WASHROOM_CLEANING',
        priority: 'HIGH',
        assignedTo: staffUser._id,
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.match(body.data.taskId, /^CLN-\d{4}-\d{5}$/);
    assert.equal(body.data.status, 'ASSIGNED');
    createdTaskId = body.data._id;
  });

  await t.test('6. Task Lifecycle: Staff accepts task', async () => {
    const res = await fetch(`${baseUrl}/cleaning/tasks/${createdTaskId}/accept`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${staffToken}` },
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.data.status, 'ACCEPTED');
    assert.ok(body.data.acceptedAt);
  });

  await t.test('7. Task Lifecycle: Staff starts task', async () => {
    const res = await fetch(`${baseUrl}/cleaning/tasks/${createdTaskId}/start`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${staffToken}` },
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.data.status, 'IN_PROGRESS');
    assert.ok(body.data.startedAt);
  });

  await t.test('8. Task Lifecycle: Staff completes task with checklist', async () => {
    const res = await fetch(`${baseUrl}/cleaning/tasks/${createdTaskId}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staffToken}`,
      },
      body: JSON.stringify({
        checklist: [
          { item: 'Floor scrubbed and disinfected', isCompleted: true, note: 'Bleach used' },
          { item: 'Toilet bowls sanitized', isCompleted: true, note: 'Done' },
          { item: 'Washbasins cleaned', isCompleted: true, note: 'Mirror polished' },
        ],
        completionNote: 'Completed sanitization round on Floor 1',
      }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.data.status, 'COMPLETED');
    assert.ok(body.data.completedAt);
    assert.equal(body.data.completionNote, 'Completed sanitization round on Floor 1');
  });

  await t.test('9. Self-Verification Guard: Assigned staff cannot self-verify task', async () => {
    // 9a: Staff cannot call verify endpoint (RBAC 403)
    const res = await fetch(`${baseUrl}/cleaning/tasks/${createdTaskId}/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staffToken}`,
      },
      body: JSON.stringify({
        qualityScore: 5,
        verificationNote: 'Staff self-verification attempt',
      }),
    });
    assert.equal(res.status, 403);

    // 9b: Even a Warden assigned to a task cannot self-verify their own task
    const wardenSelfTask = await CleaningTask.create({
      taskId: 'CLN-2026-99999',
      cleaningAreaId: createdAreaId,
      title: 'Warden Assigned Task',
      hostelId: testHostel._id,
      assignedTo: wardenUser._id,
      status: 'COMPLETED',
      dueAt: new Date(Date.now() + 3600000),
    });

    const selfRes = await fetch(`${baseUrl}/cleaning/tasks/${wardenSelfTask._id}/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${wardenToken}`,
      },
      body: JSON.stringify({ qualityScore: 5 }),
    });
    assert.equal(selfRes.status, 403);
    const body = await selfRes.json();
    assert.match(body.message, /cannot self-verify/i);
  });

  await t.test('10. Supervisor Verification: Warden verifies task with quality score', async () => {
    const res = await fetch(`${baseUrl}/cleaning/tasks/${createdTaskId}/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${wardenToken}`,
      },
      body: JSON.stringify({
        qualityScore: 5,
        verificationNote: 'Thoroughly sanitized and spotless. Excellent work.',
      }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.data.status, 'VERIFIED');
    assert.equal(body.data.qualityScore, 5);
    assert.ok(body.data.verifiedAt);
    assert.equal(body.data.verifiedBy, wardenUser._id.toString());
  });

  await t.test('11. Supervisor Rejection & Rework Flow', async () => {
    // Create second task
    const tRes = await fetch(`${baseUrl}/cleaning/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${wardenToken}`,
      },
      body: JSON.stringify({
        cleaningAreaId: createdAreaId,
        title: 'Afternoon Touchup',
        assignedTo: staffUser._id,
      }),
    });
    const tBody = await tRes.json();
    secondTaskId = tBody.data._id;

    // Staff completes
    await fetch(`${baseUrl}/cleaning/tasks/${secondTaskId}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staffToken}`,
      },
      body: JSON.stringify({ completionNote: 'Done quickly' }),
    });

    // Warden rejects
    const rejRes = await fetch(`${baseUrl}/cleaning/tasks/${secondTaskId}/reject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${wardenToken}`,
      },
      body: JSON.stringify({
        rejectionReason: 'Mirrors are still streaked and bins not emptied properly',
      }),
    });

    assert.equal(rejRes.status, 200);
    const rejBody = await rejRes.json();
    assert.equal(rejBody.data.status, 'IN_PROGRESS');
    assert.equal(rejBody.data.rejectionReason, 'Mirrors are still streaked and bins not emptied properly');
  });

  await t.test('12. Central Scheduler & Idempotent Generation', async () => {
    // Set plan nextDueAt in past to simulate due for generation
    await CleaningPlan.findByIdAndUpdate(createdPlanId, {
      nextDueAt: new Date(Date.now() - 3600 * 1000),
    });

    const results = await processCleaningTasks(new Date());
    assert.ok(results.plansProcessed >= 1);
    assert.ok(results.tasksGenerated >= 1);

    // Verify nextDueAt advanced
    const updatedPlan = await CleaningPlan.findById(createdPlanId);
    assert.ok(updatedPlan.nextDueAt > new Date());

    // Idempotency check: Running again right now should NOT generate duplicate
    const secondPass = await processCleaningTasks(new Date());
    assert.equal(secondPass.tasksGenerated, 0);
  });

  await t.test('13. Dashboard & Housekeeping KPIs', async () => {
    const res = await fetch(`${baseUrl}/cleaning/dashboard?hostelId=${testHostel._id}`, {
      headers: { Authorization: `Bearer ${wardenToken}` },
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data.summary);
    assert.ok(body.data.summary.totalAreas >= 1);
    assert.ok(body.data.summary.avgQualityScore > 0);
    assert.ok(Array.isArray(body.data.staffWorkload));
  });

  await t.test('14. Cleaning Complaint Integration: category CLEANING links to housekeeping', async () => {
    const res = await fetch(`${baseUrl}/complaints`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        title: 'Washroom water overflow and dirty basins',
        description: 'The basins are overflowing and floor needs immediate scrubbing',
        category: 'CLEANING',
        issueType: 'DIRTY_WASHROOM',
        priority: 'HIGH',
        cleaningAreaId: createdAreaId,
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.category, 'CLEANING');
    assert.equal(body.data.departmentId?._id || body.data.departmentId, testDept._id.toString());
    assert.equal(body.data.cleaningAreaId, createdAreaId.toString());
  });
});
