import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_for_suite_1234567890abcdef';
process.env.JWT_EXPIRES_IN = '1h';

const baseUri = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/bbdu_hosteller_test';
const TEST_URI = baseUri.replace(/\/([^/?]+)(\?.*)?$/, '/$1_mess$2');

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
  Mess,
  MessMenu,
  MessFeedback,
  MessNotice,
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

let testMess;

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
    Mess,
    MessMenu,
    MessFeedback,
    MessNotice,
  ].map((m) => m.init()));

  server = app.listen(0);
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}/api`;

  testHostel = await Hostel.create({
    name: 'Tagore Boys Hostel',
    code: 'TBH-MESS-TEST',
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
    name: 'Mess & Catering Services',
    code: 'MESS_SERVICES',
    description: 'Hostel mess, catering, and hygiene department',
    isActive: true,
  });

  const passwordHash = await hashPassword('Password@123');

  adminUser = await User.create({
    name: 'Chief Admin',
    email: 'admin.mess@bbdu.ac.in',
    role: 'SUPER_ADMIN',
    passwordHash,
    isActive: true,
  });

  wardenUser = await User.create({
    name: 'Warden Mess Sharma',
    email: 'warden.mess@bbdu.ac.in',
    role: 'WARDEN',
    hostelId: testHostel._id,
    passwordHash,
    isActive: true,
  });

  staffUser = await User.create({
    name: 'Chef Ramesh',
    email: 'staff.mess@bbdu.ac.in',
    role: 'HOSTEL_STAFF',
    departmentId: testDept._id,
    passwordHash,
    isActive: true,
  });

  studentUser = await User.create({
    name: 'Aakash Verma',
    email: 'student.mess@bbdu.ac.in',
    role: 'STUDENT',
    studentId: 'STU-MESS-001',
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
  await disconnectDB();
});

// Helper for authorized API calls
const apiCall = async (endpoint, method = 'GET', body = null, token = null) => {
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const options = { method, headers };
  if (body) {
    options.body = JSON.stringify(body);
  }
  const res = await fetch(`${baseUrl}${endpoint}`, options);
  const data = await res.json();
  return { status: res.status, data };
};

// ==========================================
// TEST SUITES
// ==========================================

test('1. Mess CRUD & Role-Based Authorization', async () => {
  // Student cannot create mess (403 Forbidden)
  const forbiddenRes = await apiCall(
    '/messes',
    'POST',
    {
      name: 'Student Dining',
      code: 'SD-01',
      hostelId: testHostel._id,
    },
    studentToken
  );
  assert.equal(forbiddenRes.status, 403);

  // Warden creates Mess
  const createRes = await apiCall(
    '/messes',
    'POST',
    {
      name: 'Tagore Central Dining',
      code: 'TBH-DINING-1',
      hostelId: testHostel._id,
      description: 'Main dining hall for Tagore hostel',
      managerId: staffUser._id,
      capacity: 300,
    },
    wardenToken
  );

  assert.equal(createRes.status, 201);
  assert.equal(createRes.data.success, true);
  assert.ok(createRes.data.data.messId.startsWith('MESS-'));
  assert.equal(createRes.data.data.code, 'TBH-DINING-1');
  testMess = createRes.data.data;

  // Duplicate mess code is rejected (409 Conflict)
  const dupRes = await apiCall(
    '/messes',
    'POST',
    {
      name: 'Duplicate Mess',
      code: 'TBH-DINING-1',
      hostelId: testHostel._id,
    },
    adminToken
  );
  assert.equal(dupRes.status, 409);

  // Get mess list
  const listRes = await apiCall('/messes', 'GET', null, studentToken);
  assert.equal(listRes.status, 200);
  assert.ok(listRes.data.data.length >= 1);

  // Get mess by ID
  const getByIdRes = await apiCall(`/messes/${testMess._id}`, 'GET', null, studentToken);
  assert.equal(getByIdRes.status, 200);
  assert.equal(getByIdRes.data.data.name, 'Tagore Central Dining');
});

test('2. Menu Creation, Publishing & Visibility Control', async () => {
  // Student cannot create menu (403 Forbidden)
  const studentCreateRes = await apiCall(
    `/messes/${testMess._id}/menus`,
    'POST',
    {
      dayOfWeek: 'MONDAY',
      mealType: 'BREAKFAST',
      menuItems: [{ name: 'Aloo Paratha' }],
    },
    studentToken
  );
  assert.equal(studentCreateRes.status, 403);

  // Staff creates unpublished menu
  const menuRes = await apiCall(
    `/messes/${testMess._id}/menus`,
    'POST',
    {
      dayOfWeek: 'MONDAY',
      mealType: 'BREAKFAST',
      menuItems: [
        { name: 'Poha', category: 'Main Course' },
        { name: 'Boiled Egg / Banana', category: 'Side' },
        { name: 'Masala Tea', category: 'Beverage' },
      ],
      notes: 'Breakfast served 7:30 - 9:30 AM',
      isPublished: false,
    },
    staffToken
  );
  assert.equal(menuRes.status, 200);
  assert.ok(menuRes.data.data.menuId.startsWith('MENU-'));
  assert.equal(menuRes.data.data.isPublished, false);
  const createdMenu = menuRes.data.data;

  // Student checks menu: should be hidden because isPublished is false
  const studentViewRes = await apiCall(
    `/messes/${testMess._id}/menus?dayOfWeek=MONDAY`,
    'GET',
    null,
    studentToken
  );
  assert.equal(studentViewRes.status, 200);
  assert.equal(studentViewRes.data.data.length, 0);

  // Warden publishes menu
  const publishRes = await apiCall(
    `/messes/menus/${createdMenu._id}/publish`,
    'POST',
    {},
    wardenToken
  );
  assert.equal(publishRes.status, 200);
  assert.equal(publishRes.data.data.isPublished, true);

  // Student can now view published menu
  const studentViewPublished = await apiCall(
    `/messes/${testMess._id}/menus?dayOfWeek=MONDAY`,
    'GET',
    null,
    studentToken
  );
  assert.equal(studentViewPublished.status, 200);
  assert.equal(studentViewPublished.data.data.length, 1);
  assert.equal(studentViewPublished.data.data[0].menuItems.length, 3);
});

test('3. Student Meal Feedback Submission & Duplicate Prevention', async () => {
  // Non-student cannot submit feedback (403 Forbidden)
  const nonStudentRes = await apiCall(
    '/mess-feedback',
    'POST',
    {
      messId: testMess._id,
      mealType: 'BREAKFAST',
      mealDate: '2026-10-05',
      rating: 4,
      foodQuality: 'GOOD',
    },
    wardenToken
  );
  assert.equal(nonStudentRes.status, 403);

  // Student submits valid feedback
  const feedbackRes = await apiCall(
    '/mess-feedback',
    'POST',
    {
      messId: testMess._id,
      mealType: 'BREAKFAST',
      mealDate: '2026-10-05',
      rating: 4,
      foodQuality: 'GOOD',
      taste: 4,
      hygiene: 4,
      quantity: 5,
      comments: 'Fresh, warm and well-seasoned.',
    },
    studentToken
  );

  assert.equal(feedbackRes.status, 201);
  assert.ok(feedbackRes.data.data.feedbackId.startsWith('FB-'));
  assert.equal(feedbackRes.data.data.rating, 4);
  assert.equal(feedbackRes.data.data.foodQuality, 'GOOD');

  // Duplicate submission for same meal on same date must be rejected (409 Conflict)
  const dupFeedbackRes = await apiCall(
    '/mess-feedback',
    'POST',
    {
      messId: testMess._id,
      mealType: 'BREAKFAST',
      mealDate: '2026-10-05',
      rating: 5,
      foodQuality: 'EXCELLENT',
    },
    studentToken
  );
  assert.equal(dupFeedbackRes.status, 409);

  // Student retrieves own feedback history
  const myRes = await apiCall('/mess-feedback/my', 'GET', null, studentToken);
  assert.equal(myRes.status, 200);
  assert.ok(myRes.data.data.length >= 1);
  assert.equal(myRes.data.data[0].rating, 4);
});

test('4. Food Quality Analytics & Low-Rated Meal Flagging', async () => {
  // Create another student to submit different ratings
  const student2 = await User.create({
    name: 'Rohan Gupta',
    email: 'rohan.mess@bbdu.ac.in',
    role: 'STUDENT',
    studentId: 'STU-MESS-002',
    hostelId: testHostel._id,
    passwordHash: 'hash',
    isActive: true,
  });
  const student2Token = signToken({ userId: student2._id, role: student2.role });

  // Student 2 submits low rating for DINNER
  await apiCall(
    '/mess-feedback',
    'POST',
    {
      messId: testMess._id,
      mealType: 'DINNER',
      mealDate: '2026-10-05',
      rating: 2,
      foodQuality: 'POOR',
      taste: 2,
      hygiene: 2,
      quantity: 2,
      comments: 'Cold dal and stale rotis.',
    },
    student2Token
  );

  // Student 1 submits low rating for DINNER as well
  await apiCall(
    '/mess-feedback',
    'POST',
    {
      messId: testMess._id,
      mealType: 'DINNER',
      mealDate: '2026-10-05',
      rating: 2,
      foodQuality: 'POOR',
      taste: 2,
      hygiene: 2,
      quantity: 3,
      comments: 'Substandard quality today.',
    },
    studentToken
  );

  // Fetch Analytics
  const analyticsRes = await apiCall(
    `/messes/analytics?messId=${testMess._id}`,
    'GET',
    null,
    wardenToken
  );
  assert.equal(analyticsRes.status, 200);
  assert.ok(analyticsRes.data.data.mealRatings);

  const { BREAKFAST, DINNER } = analyticsRes.data.data.mealRatings;
  assert.equal(BREAKFAST.avgRating, 4.0);
  assert.equal(DINNER.avgRating, 2.0);
  // Recurring low ratings trigger needsAttention flag
  assert.equal(DINNER.needsAttention, true);
});

test('5. Hygiene Threshold Monitoring & Operational Alert Notification', async () => {
  // Add a 3rd poor hygiene review so review count >= 3
  const student3 = await User.create({
    name: 'Kunal Singh',
    email: 'kunal.mess@bbdu.ac.in',
    role: 'STUDENT',
    studentId: 'STU-MESS-003',
    hostelId: testHostel._id,
    passwordHash: 'hash',
    isActive: true,
  });
  const student3Token = signToken({ userId: student3._id, role: student3.role });

  await apiCall(
    '/mess-feedback',
    'POST',
    {
      messId: testMess._id,
      mealType: 'LUNCH',
      mealDate: '2026-10-05',
      rating: 1,
      foodQuality: 'VERY_POOR',
      hygiene: 1,
      taste: 2,
      quantity: 2,
      comments: 'Tables dirty and unhygienic trays.',
    },
    student3Token
  );

  // Wait a moment for background notification dispatch
  await new Promise((r) => setTimeout(r, 200));

  // Check that MESS_HYGIENE_ALERT was emitted to Warden
  const alertNotif = await Notification.findOne({
    recipient: wardenUser._id,
    type: 'MESS_HYGIENE_ALERT',
  }).lean();

  assert.ok(alertNotif, 'MESS_HYGIENE_ALERT notification dispatched');
  assert.equal(alertNotif.relatedEntityType, 'MESS');
  assert.ok(alertNotif.message.includes('hygiene score'));

  // Verify dashboard reports hygiene status
  const dashRes = await apiCall(
    `/messes/dashboard?messId=${testMess._id}`,
    'GET',
    null,
    wardenToken
  );
  assert.equal(dashRes.status, 200);
  assert.ok(
    dashRes.data.data.stats.hygieneStatus === 'HYGIENE_ATTENTION_REQUIRED' ||
      dashRes.data.data.stats.hygieneStatus === 'CRITICAL_HYGIENE_ATTENTION'
  );
});

test('6. Mess Complaint Integration with Existing Complaint Engine', async () => {
  // Student reports a mess complaint using standard /api/complaints endpoint
  const complaintRes = await apiCall(
    '/complaints',
    'POST',
    {
      title: 'Foreign object found in dinner lentils',
      description: 'Discovered a small stone inside the dal during dinner service tonight.',
      category: 'MESS',
      issueType: 'FOREIGN_OBJECT',
      priority: 'CRITICAL',
      messId: testMess._id,
      mealType: 'DINNER',
      mealDate: '2026-10-05',
    },
    studentToken
  );

  assert.equal(complaintRes.status, 201);
  assert.equal(complaintRes.data.success, true);
  const complaint = complaintRes.data.data;
  assert.ok(complaint.complaintId.startsWith('CMP-'));
  assert.equal(complaint.category, 'MESS');
  assert.equal(complaint.issueType, 'FOREIGN_OBJECT');
  assert.equal(complaint.priority, 'CRITICAL');
  assert.equal(complaint.status, 'SUBMITTED');

  // Verify DB document has messId and meal metadata preserved
  const dbComplaint = await Complaint.findById(complaint._id).lean();
  assert.equal(String(dbComplaint.messId), String(testMess._id));
  assert.equal(dbComplaint.mealType, 'DINNER');
  assert.ok(dbComplaint.mealDate);

  // Verify mapped to MESS_SERVICES department
  assert.equal(String(dbComplaint.departmentId), String(testDept._id));
});

test('7. Mess Notices Management & Student Visibility', async () => {
  // Warden posts an important notice
  const noticeRes = await apiCall(
    '/mess-notices',
    'POST',
    {
      messId: testMess._id,
      title: 'Sunday Special Meal Schedule',
      message: 'On Sunday, special Pav Bhaji and Gulab Jamun will be served at lunch.',
      priority: 'IMPORTANT',
    },
    wardenToken
  );

  assert.equal(noticeRes.status, 201);
  assert.ok(noticeRes.data.data.noticeId.startsWith('MNOT-'));
  assert.equal(noticeRes.data.data.isActive, true);
  const createdNotice = noticeRes.data.data;

  // Student views active notices
  const getNoticesRes = await apiCall(
    `/mess-notices?messId=${testMess._id}`,
    'GET',
    null,
    studentToken
  );
  assert.equal(getNoticesRes.status, 200);
  assert.ok(getNoticesRes.data.data.length >= 1);
  assert.equal(getNoticesRes.data.data[0].title, 'Sunday Special Meal Schedule');

  // Deactivate notice
  const toggleRes = await apiCall(
    `/mess-notices/${createdNotice._id}/toggle`,
    'PATCH',
    { isActive: false },
    wardenToken
  );
  assert.equal(toggleRes.status, 200);
  assert.equal(toggleRes.data.data.isActive, false);
});
