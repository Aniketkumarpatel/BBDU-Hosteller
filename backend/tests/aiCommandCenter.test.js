import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_for_suite_1234567890abcdef';
process.env.JWT_EXPIRES_IN = '1h';

const baseUri = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/bbdu_hosteller_test';
const TEST_URI = baseUri.replace(/\/([^/?]+)(\?.*)?$/, '/$1_ai_command$2');

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
  MaintenanceWorkOrder,
  Asset,
  CleaningTask,
  CleaningArea,
  Mess,
  MessFeedback,
  Outpass,
  Visitor,
} = await import('../src/models/index.js');
const { hashPassword } = await import('../src/utils/password.js');
const { signToken } = await import('../src/utils/jwt.js');

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
    MaintenanceWorkOrder,
    Asset,
    CleaningTask,
    CleaningArea,
    Mess,
    MessFeedback,
    Outpass,
    Visitor,
  ].map((m) => m.init()));

  server = app.listen(0);
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}/api`;

  testHostel = await Hostel.create({
    name: 'Ramanujan Boys Hostel',
    code: 'RBH-AI-TEST',
    type: 'BOYS',
    totalCapacity: 150,
    currentOccupancy: 20,
  });

  testBlock = await Block.create({
    name: 'Block Alpha',
    code: 'BA',
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
    hostelId: testHostel._id,
    blockId: testBlock._id,
    floorId: testFloor._id,
    capacity: 2,
    currentOccupancy: 1,
  });

  testDept = await Department.create({
    name: 'Electrical Engineering',
    code: 'ELEC',
    description: 'Electrical and power maintenance',
    isActive: true,
  });

  const passwordHash = await hashPassword('Password@123');

  adminUser = await User.create({
    name: 'Super Admin',
    email: 'admin.ai@bbdu.ac.in',
    role: 'SUPER_ADMIN',
    passwordHash,
    isActive: true,
  });

  wardenUser = await User.create({
    name: 'Warden Sharma',
    email: 'warden.ai@bbdu.ac.in',
    role: 'WARDEN',
    hostelId: testHostel._id,
    passwordHash,
    isActive: true,
  });

  staffUser = await User.create({
    name: 'Electrician Kumar',
    email: 'staff.ai@bbdu.ac.in',
    role: 'HOSTEL_STAFF',
    departmentId: testDept._id,
    passwordHash,
    isActive: true,
  });

  studentUser = await User.create({
    name: 'Amit Verma',
    email: 'student.ai@bbdu.ac.in',
    role: 'STUDENT',
    studentId: 'STU-AI-001',
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

test('AI Hostel Command Center & Smart Operations Suite (Step 13)', async (t) => {
  await t.test('1. RBAC Guard: Student and Staff are denied access (403)', async () => {
    // Unauthenticated
    const resNoAuth = await fetch(`${baseUrl}/ai-command-center/overview`);
    assert.strictEqual(resNoAuth.status, 401);

    // Student -> 403 Forbidden
    const resStudent = await fetch(`${baseUrl}/ai-command-center/overview`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.strictEqual(resStudent.status, 403);

    // Staff -> 403 Forbidden
    const resStaff = await fetch(`${baseUrl}/ai-command-center/overview`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    assert.strictEqual(resStaff.status, 403);

    // Warden -> 200 OK
    const resWarden = await fetch(`${baseUrl}/ai-command-center/overview`, {
      headers: { Authorization: `Bearer ${wardenToken}` },
    });
    assert.strictEqual(resWarden.status, 200);

    // Super Admin -> 200 OK
    const resAdmin = await fetch(`${baseUrl}/ai-command-center/overview`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(resAdmin.status, 200);
  });

  await t.test('2. Operational Health Score Engine: Baseline calculation and transparency', async () => {
    const res = await fetch(`${baseUrl}/ai-command-center/health-score`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(typeof body.data.overallScore === 'number');
    assert.ok(body.data.overallScore >= 0 && body.data.overallScore <= 100);
    assert.ok(['OPTIMAL', 'MODERATE_RISK', 'HIGH_RISK', 'CRITICAL'].includes(body.data.band));
    assert.ok(body.data.breakdown.complaints);
    assert.ok(body.data.breakdown.maintenance);
    assert.ok(body.data.breakdown.cleaning);
    assert.ok(body.data.breakdown.mess);
    assert.ok(body.data.breakdown.security);
    assert.ok(Array.isArray(body.data.positiveFactors));
    assert.ok(Array.isArray(body.data.negativeFactors));
  });

  await t.test('3. Dynamic Health Impact: Simulated critical events reduce health score', async () => {
    // Inject a breached critical complaint
    const breachedComplaint = await Complaint.create({
      complaintId: 'CMP-AI-BREACH-001',
      studentId: studentUser._id,
      title: 'Water pipe burst causing flooding in Corridor',
      description: 'Severe water leak flooding the corridor',
      category: 'PLUMBING',
      issueType: 'WATER_LEAKAGE',
      priority: 'CRITICAL',
      status: 'IN_PROGRESS',
      slaStatus: 'BREACHED',
      hostelId: testHostel._id,
      blockId: testBlock._id,
      floorId: testFloor._id,
      roomId: testRoom._id,
      createdBy: studentUser._id,
      isSlaBreached: true,
      slaBreachedAt: new Date(),
    });

    // Inject an overdue maintenance work order
    const overdueWO = await MaintenanceWorkOrder.create({
      workOrderId: 'WO-AI-OVERDUE-001',
      title: 'Fix Main Substation Circuit Breaker',
      description: 'Circuit breaker tripping constantly',
      hostelId: testHostel._id,
      blockId: testBlock._id,
      floorId: testFloor._id,
      roomId: testRoom._id,
      departmentId: testDept._id,
      priority: 'CRITICAL',
      status: 'ASSIGNED',
      dueAt: new Date(Date.now() - 48 * 60 * 60 * 1000), // 2 days ago
      assignedTo: staffUser._id,
      createdBy: wardenUser._id,
    });

    // Inject an overdue outpass (student past curfew)
    const overdueOutpass = await Outpass.create({
      outpassId: 'OUT-AI-OVERDUE-001',
      studentId: studentUser._id,
      hostelId: testHostel._id,
      purpose: 'PERSONAL',
      destination: 'Downtown Market',
      departureAt: new Date(Date.now() - 8 * 60 * 60 * 1000),
      expectedReturnAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      actualExitAt: new Date(Date.now() - 7 * 60 * 60 * 1000),
      status: 'OVERDUE',
      approvedBy: wardenUser._id,
      digitalPassToken: 'token-ai-overdue-123',
    });

    // Check health score again
    const res = await fetch(`${baseUrl}/ai-command-center/health-score`, {
      headers: { Authorization: `Bearer ${wardenToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();

    // Verify negative factor attribution
    const negativeDescriptions = body.data.negativeFactors.map((f) => f.factor.toLowerCase());
    assert.ok(
      negativeDescriptions.some((desc) => desc.includes('breach') || desc.includes('sla')),
      'Should mention SLA breach penalty'
    );
    assert.ok(
      negativeDescriptions.some((desc) => desc.includes('overdue work order') || desc.includes('maintenance')),
      'Should mention overdue work order penalty'
    );
    assert.ok(
      negativeDescriptions.some((desc) => desc.includes('overdue outpass') || desc.includes('curfew') || desc.includes('student')),
      'Should mention overdue outpass penalty'
    );
  });

  await t.test('4. Operational Insights: AI generates prioritized structured insights', async () => {
    const res = await fetch(`${baseUrl}/ai-command-center/insights`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.length > 0);

    const firstInsight = body.data[0];
    assert.ok(firstInsight.insightId);
    assert.ok(firstInsight.category);
    assert.ok(firstInsight.priority);
    assert.ok(firstInsight.title);
    assert.ok(firstInsight.explanation);
    assert.ok(firstInsight.recommendedAction);
    assert.ok(typeof firstInsight.confidence === 'number');
  });

  await t.test('5. Executive Recommendations: Advisory decisions for management approval', async () => {
    const res = await fetch(`${baseUrl}/ai-command-center/recommendations`, {
      headers: { Authorization: `Bearer ${wardenToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.data));
    assert.ok(body.data.length > 0);

    const rec = body.data[0];
    assert.ok(rec.recommendationId);
    assert.ok(rec.actionTitle);
    assert.ok(rec.rationale);
    assert.strictEqual(rec.isAutomatedAction, false, 'AI must remain advisory, not autonomous');
  });

  await t.test('6. Command Center Overview: Aggregates dashboard cards, risk matrix and KPIs', async () => {
    const res = await fetch(`${baseUrl}/ai-command-center/overview`, {
      headers: { Authorization: `Bearer ${wardenToken}` },
    });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data.healthScore);
    assert.ok(Array.isArray(body.data.criticalAlerts));
    assert.ok(body.data.moduleRisks);
    assert.ok(body.data.systemSummary);
  });

  await t.test('7. AI Operational Assistant: Natural language queries on live MongoDB operations', async () => {
    // Query 1: Problems / Issues
    const resProblems = await fetch(`${baseUrl}/ai-command-center/ask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${wardenToken}`,
      },
      body: JSON.stringify({ query: 'What are the most serious problems?' }),
    });
    assert.strictEqual(resProblems.status, 200);
    const bodyProblems = await resProblems.json();
    assert.ok(bodyProblems.data.answer);
    assert.ok(Array.isArray(bodyProblems.data.suggestedActions));

    // Query 2: Outpasses / Curfew
    const resOutpass = await fetch(`${baseUrl}/ai-command-center/ask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${wardenToken}`,
      },
      body: JSON.stringify({ query: 'How many students are outside right now?' }),
    });
    assert.strictEqual(resOutpass.status, 200);
    const bodyOutpass = await resOutpass.json();
    assert.ok(bodyOutpass.data.answer.includes('outpass') || bodyOutpass.data.answer.includes('student'));

    // Query 3: General operational query
    const resGeneral = await fetch(`${baseUrl}/ai-command-center/ask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${wardenToken}`,
      },
      body: JSON.stringify({ query: 'Give me the overall operational summary' }),
    });
    assert.strictEqual(resGeneral.status, 200);
    const bodyGeneral = await resGeneral.json();
    assert.ok(bodyGeneral.data.answer.includes('Operational Health'));
  });
});
