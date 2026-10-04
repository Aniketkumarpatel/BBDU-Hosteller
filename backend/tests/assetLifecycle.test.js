import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_for_suite_1234567890abcdef';
process.env.JWT_EXPIRES_IN = '1h';

const baseUri = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/bbdu_hosteller_test';
const TEST_URI = baseUri.replace(/\/([^/?]+)(\?.*)?$/, '/$1_asset_lifecycle$2');

const { connectDB, disconnectDB } = await import('../src/config/db.js');
const { default: app } = await import('../src/app.js');
const {
  User,
  Hostel,
  Block,
  Floor,
  Room,
  Department,
  Asset,
  MaintenanceWorkOrder,
  Complaint,
  Notification,
} = await import('../src/models/index.js');
const { hashPassword } = await import('../src/utils/password.js');
const { signToken } = await import('../src/utils/jwt.js');
const { processAssetLifecycleJobs } = await import('../src/services/asset.service.js');

let server;
let baseUrl;

let adminToken;
let wardenAToken;
let wardenBToken;
let staffToken;
let studentToken;

let hostelA;
let hostelB;
let blockA1;
let blockA2;
let floorA1;
let roomA101;
let roomA102;
let testDept;

let adminUser;
let wardenAUser;
let wardenBUser;
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
    Asset,
    MaintenanceWorkOrder,
    Complaint,
    Notification,
  ].map((m) => m.init()));

  server = app.listen(0);
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}/api`;

  hostelA = await Hostel.create({
    name: 'Tagore Hostel A',
    code: 'THA-14',
    type: 'BOYS',
    totalCapacity: 100,
    currentOccupancy: 10,
  });

  hostelB = await Hostel.create({
    name: 'Sarojini Hostel B',
    code: 'SHB-14',
    type: 'GIRLS',
    totalCapacity: 100,
    currentOccupancy: 10,
  });

  blockA1 = await Block.create({
    name: 'Block Alpha',
    code: 'A1',
    hostelId: hostelA._id,
  });

  blockA2 = await Block.create({
    name: 'Block Beta',
    code: 'A2',
    hostelId: hostelA._id,
  });

  floorA1 = await Floor.create({
    floorNumber: 1,
    name: 'First Floor',
    hostelId: hostelA._id,
    blockId: blockA1._id,
  });

  roomA101 = await Room.create({
    roomNumber: '101',
    roomType: 'DOUBLE',
    hostelId: hostelA._id,
    blockId: blockA1._id,
    floorId: floorA1._id,
    capacity: 2,
    currentOccupancy: 1,
  });

  roomA102 = await Room.create({
    roomNumber: '102',
    roomType: 'DOUBLE',
    hostelId: hostelA._id,
    blockId: blockA1._id,
    floorId: floorA1._id,
    capacity: 2,
    currentOccupancy: 0,
  });

  testDept = await Department.create({
    name: 'Electrical Maintenance',
    code: 'ELEC-14',
    description: 'Electrical and lighting facilities',
    isActive: true,
  });

  const passwordHash = await hashPassword('Password@123');

  adminUser = await User.create({
    name: 'Super Admin',
    email: 'admin.inv@bbdu.ac.in',
    role: 'SUPER_ADMIN',
    passwordHash,
    isActive: true,
  });

  wardenAUser = await User.create({
    name: 'Warden Hostel A',
    email: 'warden.a@bbdu.ac.in',
    role: 'WARDEN',
    hostelId: hostelA._id,
    passwordHash,
    isActive: true,
  });

  wardenBUser = await User.create({
    name: 'Warden Hostel B',
    email: 'warden.b@bbdu.ac.in',
    role: 'WARDEN',
    hostelId: hostelB._id,
    passwordHash,
    isActive: true,
  });

  staffUser = await User.create({
    name: 'Electrician Ramesh',
    email: 'staff.inv@bbdu.ac.in',
    role: 'HOSTEL_STAFF',
    departmentId: testDept._id,
    passwordHash,
    isActive: true,
  });

  studentUser = await User.create({
    name: 'Rahul Resident',
    email: 'student.inv@bbdu.ac.in',
    role: 'STUDENT',
    studentId: 'STU-INV-001',
    hostelId: hostelA._id,
    blockId: blockA1._id,
    floorId: floorA1._id,
    roomId: roomA101._id,
    passwordHash,
    isActive: true,
  });

  adminToken = signToken({ userId: adminUser._id, role: adminUser.role });
  wardenAToken = signToken({ userId: wardenAUser._id, role: wardenAUser.role });
  wardenBToken = signToken({ userId: wardenBUser._id, role: wardenBUser.role });
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

test('Hostel Inventory & Asset Lifecycle Management Suite (Step 14)', async (t) => {
  let createdAssetId;
  let createdAssetRawId;

  await t.test('1. Asset Registration: Admin / Warden creates asset with specs, costs and warranty', async () => {
    const purchaseDate = new Date('2024-01-15');
    const warrantyExpiry = new Date(Date.now() + 180 * 24 * 3600 * 1000); // 180 days in future

    const res = await fetch(`${baseUrl}/assets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${wardenAToken}`,
      },
      body: JSON.stringify({
        name: 'Havells Stealth Air Ceiling Fan',
        assetType: 'FAN',
        category: 'ELECTRICAL',
        description: 'Aerodynamic BLDC ceiling fan with remote',
        hostelId: hostelA._id,
        blockId: blockA1._id,
        floorId: floorA1._id,
        roomId: roomA101._id,
        departmentId: testDept._id,
        serialNumber: 'HVL-FAN-2024-001',
        modelNumber: 'STEALTH-AIR-1200',
        manufacturer: 'Havells India Ltd.',
        vendor: 'Lucknow Electrical Supplies',
        purchaseDate: purchaseDate.toISOString(),
        purchaseCost: 4500,
        warrantyStartDate: purchaseDate.toISOString(),
        warrantyExpiryDate: warrantyExpiry.toISOString(),
        expectedLifeYears: 7,
        condition: 'GOOD',
      }),
    });

    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.match(body.data.assetId, /^AST-\d{4}-\d{5}$/);
    assert.strictEqual(body.data.name, 'Havells Stealth Air Ceiling Fan');
    assert.strictEqual(body.data.purchaseCost, 4500);
    assert.strictEqual(body.data.condition, 'GOOD');
    assert.strictEqual(body.data.status, 'ACTIVE');

    createdAssetId = body.data.assetId;
    createdAssetRawId = body.data._id;
  });

  await t.test('2. Duplicate Serial Number Guard: Prevents duplicate serial within same hostel', async () => {
    const res = await fetch(`${baseUrl}/assets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${wardenAToken}`,
      },
      body: JSON.stringify({
        name: 'Duplicate Serial Fan',
        assetType: 'FAN',
        category: 'ELECTRICAL',
        hostelId: hostelA._id,
        departmentId: testDept._id,
        serialNumber: 'HVL-FAN-2024-001', // Already exists in Hostel A
      }),
    });

    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.ok(body.message.includes('already exists'));
  });

  await t.test('3. Location Hierarchy Guard: Rejects mismatched block and floor assignment', async () => {
    const res = await fetch(`${baseUrl}/assets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Mismatched Asset',
        assetType: 'LIGHT',
        category: 'ELECTRICAL',
        hostelId: hostelA._id,
        blockId: blockA2._id, // Block A2
        floorId: floorA1._id, // Belongs to Block A1! Mismatch!
        departmentId: testDept._id,
      }),
    });

    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.ok(body.message.includes('hierarchy'));
  });

  await t.test('4. Asset Movement & Allocation: Move asset with mandatory audit and reason', async () => {
    const res = await fetch(`${baseUrl}/assets/${createdAssetRawId}/move`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${wardenAToken}`,
      },
      body: JSON.stringify({
        hostelId: hostelA._id,
        blockId: blockA1._id,
        floorId: floorA1._id,
        roomId: roomA102._id, // Moving from Room 101 to Room 102
        reason: 'Relocated due to room renovation and occupant re-assignment',
      }),
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(String(body.data.roomId), String(roomA102._id));
    assert.ok(Array.isArray(body.data.movementHistory));
    assert.strictEqual(body.data.movementHistory.length, 1);
    assert.strictEqual(body.data.movementHistory[0].reason, 'Relocated due to room renovation and occupant re-assignment');
  });

  await t.test('5. Common Area Asset Support: Allocate asset to hostel common area', async () => {
    const res = await fetch(`${baseUrl}/assets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${wardenAToken}`,
      },
      body: JSON.stringify({
        name: 'Kent Grand Plus RO Water Purifier',
        assetType: 'RO',
        category: 'PLUMBING',
        hostelId: hostelA._id,
        commonArea: 'Mess Dining Hall',
        departmentId: testDept._id,
        purchaseCost: 16500,
        condition: 'GOOD',
      }),
    });

    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.commonArea, 'Mess Dining Hall');
    assert.strictEqual(body.data.roomId, null);
  });

  await t.test('6. Condition Monitoring & Audit: Staff updates physical condition with audit trail', async () => {
    const res = await fetch(`${baseUrl}/assets/${createdAssetRawId}/condition`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staffToken}`,
      },
      body: JSON.stringify({
        condition: 'POOR',
        reason: 'Motor coil overheating and capacitor worn out during inspection',
      }),
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.condition, 'POOR');
    assert.ok(Array.isArray(body.data.conditionHistory));
    assert.strictEqual(body.data.conditionHistory.length, 1);
    assert.strictEqual(body.data.conditionHistory[0].previousCondition, 'GOOD');
    assert.strictEqual(body.data.conditionHistory[0].newCondition, 'POOR');
  });

  await t.test('7. Student Permission Guard: Student cannot update asset condition or move asset', async () => {
    const moveRes = await fetch(`${baseUrl}/assets/${createdAssetRawId}/move`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        reason: 'Student attempting unauthorized movement',
      }),
    });
    assert.strictEqual(moveRes.status, 403);

    const condRes = await fetch(`${baseUrl}/assets/${createdAssetRawId}/condition`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        condition: 'GOOD',
      }),
    });
    assert.strictEqual(condRes.status, 403);
  });

  await t.test('8. Maintenance & Repair Cost Tracking: Completing work order increments asset repair cost', async () => {
    // 1. Create a work order linked to our asset
    const wo = await MaintenanceWorkOrder.create({
      workOrderId: 'WO-COST-TEST-001',
      title: 'Replace burnt capacitor and bearing',
      description: 'Motor coil inspection and bearing replacement',
      hostelId: hostelA._id,
      departmentId: testDept._id,
      assetId: createdAssetRawId,
      assignedTo: staffUser._id,
      createdBy: wardenAUser._id,
      priority: 'HIGH',
      status: 'IN_PROGRESS',
    });

    // 2. Staff completes work order with itemized costs
    const completeRes = await fetch(`${baseUrl}/work-orders/${wo._id}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staffToken}`,
      },
      body: JSON.stringify({
        completionNote: 'Replaced bearing set and heavy duty capacitor successfully.',
        laborCost: 400,
        partsCost: 650,
        serviceCost: 150,
        otherCost: 50,
      }),
    });

    assert.strictEqual(completeRes.status, 200);
    const completeBody = await completeRes.json();
    assert.strictEqual(completeBody.success, true);
    assert.strictEqual(completeBody.data.laborCost, 400);
    assert.strictEqual(completeBody.data.partsCost, 650);
    assert.strictEqual(completeBody.data.totalCost, 1250); // 400 + 650 + 150 + 50

    // 3. Verify asset cumulative maintenance cost was updated
    const assetRes = await fetch(`${baseUrl}/assets/${createdAssetRawId}`, {
      headers: { Authorization: `Bearer ${wardenAToken}` },
    });
    const assetBody = await assetRes.json();
    assert.strictEqual(assetBody.data.totalMaintenanceCost, 1250);
    assert.strictEqual(assetBody.data.completedMaintenanceCount, 1);
  });

  await t.test('9. Negative Cost Input Validation: Server rejects negative cost components', async () => {
    const wo = await MaintenanceWorkOrder.create({
      workOrderId: 'WO-COST-TEST-002',
      title: 'Negative cost test',
      description: 'Testing validation on negative monetary inputs',
      hostelId: hostelA._id,
      departmentId: testDept._id,
      assignedTo: staffUser._id,
      createdBy: wardenAUser._id,
      status: 'IN_PROGRESS',
    });

    const res = await fetch(`${baseUrl}/work-orders/${wo._id}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staffToken}`,
      },
      body: JSON.stringify({
        completionNote: 'Completed work order with invalid costs',
        partsCost: -500, // Invalid negative cost!
      }),
    });

    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.ok(body.message.includes('negative'));
  });

  await t.test('10. Transparent Asset Health Score & Contributing Factors: Explainable evaluation', async () => {
    const res = await fetch(`${baseUrl}/assets/${createdAssetRawId}/health`, {
      headers: { Authorization: `Bearer ${wardenAToken}` },
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(typeof body.data.score === 'number');
    assert.ok(body.data.score >= 0 && body.data.score <= 100);
    assert.ok(Array.isArray(body.data.contributingFactors));
    assert.ok(body.data.contributingFactors.length > 0);
    assert.ok(body.data.contributingFactors.some((f) => f.factor.includes('POOR')));
    assert.ok(body.data.warranty);
    assert.ok(body.data.warranty.status);
  });

  await t.test('11. Warranty Status Determination: Active vs Expiring Soon vs Expired', async () => {
    // 1. Asset with Expiring Soon warranty (in 15 days)
    const expiringSoonAsset = await Asset.create({
      assetId: 'AST-2026-WAR01',
      name: 'Expiring Soon Lighting Fixture',
      category: 'ELECTRICAL',
      hostelId: hostelA._id,
      departmentId: testDept._id,
      warrantyExpiryDate: new Date(Date.now() + 15 * 24 * 3600 * 1000), // in 15 days
    });

    // 2. Asset with Expired warranty (30 days ago)
    const expiredAsset = await Asset.create({
      assetId: 'AST-2026-WAR02',
      name: 'Expired Geyser Water Heater',
      category: 'PLUMBING',
      hostelId: hostelA._id,
      departmentId: testDept._id,
      warrantyExpiryDate: new Date(Date.now() - 30 * 24 * 3600 * 1000), // 30 days ago
    });

    const res1 = await fetch(`${baseUrl}/assets/${expiringSoonAsset._id}`, {
      headers: { Authorization: `Bearer ${wardenAToken}` },
    });
    const body1 = await res1.json();
    assert.strictEqual(body1.data.warranty.status, 'EXPIRING_SOON');
    assert.ok(body1.data.warranty.daysRemaining <= 15);

    const res2 = await fetch(`${baseUrl}/assets/${expiredAsset._id}`, {
      headers: { Authorization: `Bearer ${wardenAToken}` },
    });
    const body2 = await res2.json();
    assert.strictEqual(body2.data.warranty.status, 'EXPIRED');
    assert.ok(body2.data.warranty.expiredDaysAgo >= 29);
  });

  await t.test('12. Repeated Breakdown Detection & Replacement Recommendation: Advisory flagging', async () => {
    // Inject repeated failures for our asset (4 work orders)
    await MaintenanceWorkOrder.create([
      {
        workOrderId: 'WO-FAIL-001',
        title: 'Motor spark',
        description: 'Sparking issue',
        hostelId: hostelA._id,
        departmentId: testDept._id,
        assetId: createdAssetRawId,
        status: 'COMPLETED',
        createdBy: wardenAUser._id,
        createdAt: new Date(Date.now() - 10 * 24 * 3600 * 1000),
      },
      {
        workOrderId: 'WO-FAIL-002',
        title: 'Vibration noise',
        description: 'Vibration issue',
        hostelId: hostelA._id,
        departmentId: testDept._id,
        assetId: createdAssetRawId,
        status: 'COMPLETED',
        createdBy: wardenAUser._id,
        createdAt: new Date(Date.now() - 20 * 24 * 3600 * 1000),
      },
      {
        workOrderId: 'WO-FAIL-003',
        title: 'Speed drop',
        description: 'Motor speed reduction',
        hostelId: hostelA._id,
        departmentId: testDept._id,
        assetId: createdAssetRawId,
        status: 'COMPLETED',
        createdBy: wardenAUser._id,
        createdAt: new Date(Date.now() - 30 * 24 * 3600 * 1000),
      },
    ]);

    const res = await fetch(`${baseUrl}/assets/${createdAssetRawId}/health`, {
      headers: { Authorization: `Bearer ${wardenAToken}` },
    });
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(['FREQUENT_FAILURE', 'CRITICAL'].includes(body.data.operationalFlag));
    assert.strictEqual(body.data.isReplacementCandidate, true);
    assert.ok(body.data.recommendations.some((r) => r.includes('Replacement Review')));
  });

  await t.test('13. Asset Retirement: Warden moves asset to RETIRED with soft audit', async () => {
    const res = await fetch(`${baseUrl}/assets/${createdAssetRawId}/retire`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${wardenAToken}`,
      },
      body: JSON.stringify({
        reason: 'Beyond economical repair after repeated motor burnout',
        remarks: 'Salvaged remote controller for spare parts',
      }),
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.status, 'RETIRED');

    // Verify record still exists (never hard deleted!)
    const verifyDoc = await Asset.findById(createdAssetRawId);
    assert.ok(verifyDoc);
    assert.strictEqual(verifyDoc.status, 'RETIRED');
    const lastAudit = verifyDoc.lifecycleAuditLog[verifyDoc.lifecycleAuditLog.length - 1];
    assert.strictEqual(lastAudit.action, 'RETIRED');
    assert.strictEqual(lastAudit.reason, 'Beyond economical repair after repeated motor burnout');
  });

  await t.test('14. Asset Disposal: Admin permanently scraps asset with audit log', async () => {
    const res = await fetch(`${baseUrl}/assets/${createdAssetRawId}/dispose`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        reason: 'Handed over to authorized university e-waste recycling agency',
        remarks: 'Disposal certificate receipt logged in admin office',
      }),
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.status, 'DISPOSED');
  });

  await t.test('15. Hostel Data Isolation Guard: Warden A cannot access or mutate Hostel B assets', async () => {
    // Create an asset in Hostel B
    const assetInHostelB = await Asset.create({
      assetId: 'AST-2026-HOSTELB-01',
      name: 'Hostel B Water Cooler',
      category: 'WATER',
      hostelId: hostelB._id,
      departmentId: testDept._id,
      status: 'ACTIVE',
      condition: 'GOOD',
    });

    // Warden A attempts to GET Hostel B asset -> 403 Forbidden
    const getRes = await fetch(`${baseUrl}/assets/${assetInHostelB._id}`, {
      headers: { Authorization: `Bearer ${wardenAToken}` },
    });
    assert.strictEqual(getRes.status, 403);

    // Warden A attempts to MOVE Hostel B asset -> 403 Forbidden
    const moveRes = await fetch(`${baseUrl}/assets/${assetInHostelB._id}/move`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${wardenAToken}`,
      },
      body: JSON.stringify({ reason: 'Malicious relocation attempt' }),
    });
    assert.strictEqual(moveRes.status, 403);

    // Warden A attempts to RETIRE Hostel B asset -> 403 Forbidden
    const retireRes = await fetch(`${baseUrl}/assets/${assetInHostelB._id}/retire`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${wardenAToken}`,
      },
      body: JSON.stringify({ reason: 'Malicious retirement attempt' }),
    });
    assert.strictEqual(retireRes.status, 403);
  });

  await t.test('16. Malicious Injection Guard: Safe handling of invalid / malicious IDs', async () => {
    // Malicious parameter string
    const res = await fetch(`${baseUrl}/assets/not-a-valid-id-or-code-999999999`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(res.status, 404);
  });

  await t.test('17. Inventory Dashboard & Cost Analytics: Aggregation metrics across physical assets', async () => {
    const dashRes = await fetch(`${baseUrl}/assets/dashboard`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(dashRes.status, 200);
    const dashBody = await dashRes.json();
    assert.strictEqual(dashBody.success, true);
    assert.ok(dashBody.data.kpis);
    assert.ok(dashBody.data.kpis.totalAssets >= 3);
    assert.ok(typeof dashBody.data.kpis.totalAssetValue === 'number');
    assert.ok(typeof dashBody.data.kpis.totalMaintenanceCost === 'number');
    assert.ok(Array.isArray(dashBody.data.warrantyAlerts));

    const analyticsRes = await fetch(`${baseUrl}/assets/analytics`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(analyticsRes.status, 200);
    const analyticsBody = await analyticsRes.json();
    assert.strictEqual(analyticsBody.success, true);
    assert.ok(Array.isArray(analyticsBody.data.costByCategory));
  });

  await t.test('18. Central Scheduler Lifecycle Worker: Dispatches warranty alerts idempotently', async () => {
    const run1 = await processAssetLifecycleJobs(new Date());
    assert.ok(typeof run1.warrantyExpiringCount === 'number');
    assert.ok(typeof run1.notificationsDispatched === 'number');

    // Repeated execution within cooldown window does not spam duplicate notifications
    const run2 = await processAssetLifecycleJobs(new Date());
    assert.strictEqual(run2.notificationsDispatched, 0, 'Must be idempotent and respect cooldown');
  });
});
