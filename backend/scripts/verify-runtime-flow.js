import assert from 'node:assert/strict';

const BACKEND_URL = 'http://localhost:5000';
const FRONTEND_URL = 'http://localhost:5173';

async function runRuntimeVerification() {
  console.log('--- Starting Live Runtime Verification ---');

  // 1. Check Frontend & Backend reachability
  console.log('\n1. Checking frontend dev server reachability...');
  const feRes = await fetch(`${FRONTEND_URL}/register`);
  assert.equal(feRes.status, 200, 'Frontend registration page must respond with 200 OK');
  const feHtml = await feRes.text();
  assert.ok(feHtml.includes('<div id="root">'), 'Frontend index HTML served');
  console.log('✓ Frontend dev server responding on http://localhost:5173/register');

  console.log('\n2. Checking backend health...');
  const healthRes = await fetch(`${BACKEND_URL}/api/health`);
  assert.equal(healthRes.status, 200, 'Backend health must respond with 200 OK');
  console.log('✓ Backend API responding on http://localhost:5000/api/health');

  // 2. Check Hostel Name Options from Live API
  console.log('\n3. Fetching live Hostel Name options...');
  const hostelRes = await fetch(`${BACKEND_URL}/api/auth/hostels`);
  assert.equal(hostelRes.status, 200, 'Hostels lookup must return 200');
  const hostelBody = await hostelRes.json();
  assert.equal(hostelBody.success, true);
  const hostels = hostelBody.data.hostels;

  const expectedHostelNames = [
    'BBDU A and B Block',
    'BBDU C and D Block',
    'Dr. Nirmala Devi Girls Hostel',
    'Justice D.P. Gupta Girls Hostel',
    'Sheela Devi Girls Hostel',
    'Shail Devi Girls Hostel',
    'BBDU Girls Hostel',
  ];

  const actualHostelNames = hostels.map((h) => h.name);
  console.log('Live Hostel Names found:', actualHostelNames);

  for (const name of expectedHostelNames) {
    assert.ok(
      actualHostelNames.includes(name),
      `Hostel list must include "${name}"`
    );
  }
  console.log('✓ All 7 required Hostel Names verified in live backend!');

  // 3. Verify Dependent Dropdown Cascade: Hostel -> Block -> Floor -> Room
  const selectedHostel = hostels.find((h) => h.name === 'BBDU A and B Block');
  assert.ok(selectedHostel, 'Selected hostel BBDU A and B Block must exist');

  console.log(`\n4. Fetching Blocks for Hostel "${selectedHostel.name}" (${selectedHostel._id})...`);
  const blockRes = await fetch(`${BACKEND_URL}/api/auth/blocks?hostelId=${selectedHostel._id}`);
  assert.equal(blockRes.status, 200);
  const blockBody = await blockRes.json();
  const blocks = blockBody.data.blocks;
  const blockNames = blocks.map((b) => b.name);
  console.log('Live Blocks found:', blockNames);
  assert.ok(blockNames.includes('1'), 'Block 1 must exist');
  assert.ok(blockNames.includes('2'), 'Block 2 must exist');
  assert.ok(blockNames.includes('3'), 'Block 3 must exist');
  console.log('✓ Dependent Block options (1, 2, 3) verified!');

  const selectedBlock = blocks.find((b) => b.name === '1');
  console.log(`\n5. Fetching Floors for Block "${selectedBlock.name}" (${selectedBlock._id})...`);
  const floorRes = await fetch(`${BACKEND_URL}/api/auth/floors?blockId=${selectedBlock._id}`);
  assert.equal(floorRes.status, 200);
  const floorBody = await floorRes.json();
  const floors = floorBody.data.floors;
  const floorNumbers = floors.map((f) => f.floorNumber);
  console.log('Live Floor numbers found:', floorNumbers);
  assert.ok(floorNumbers.includes(1), 'Floor 1 must exist');
  assert.ok(floorNumbers.includes(2), 'Floor 2 must exist');
  assert.ok(floorNumbers.includes(3), 'Floor 3 must exist');
  console.log('✓ Dependent Floor options (1, 2, 3) verified!');

  const selectedFloor = floors.find((f) => f.floorNumber === 1);
  console.log(`\n6. Fetching available Rooms for Floor "${selectedFloor.floorNumber}" (${selectedFloor._id})...`);
  const roomRes = await fetch(`${BACKEND_URL}/api/auth/rooms?floorId=${selectedFloor._id}`);
  assert.equal(roomRes.status, 200);
  const roomBody = await roomRes.json();
  const rooms = roomBody.data.rooms;
  const roomNumbers = rooms.map((r) => r.roomNumber);
  console.log('Live available Room numbers found:', roomNumbers);
  assert.ok(rooms.length > 0, 'Available rooms must be present');
  console.log('✓ Dependent Room Number options verified!');

  const selectedRoom = rooms[0];

  // 4. Register a new student with full hostel allocation
  const uniqueEmail = `live_resident_${Date.now()}@bbdu.ac.in`;
  const uniqueStudentId = `BBDU2026-LIVE-${Date.now().toString().slice(-4)}`;

  console.log('\n7. Registering new student with allocation...');
  const regPayload = {
    name: 'Runtime Verified Resident',
    email: uniqueEmail,
    studentId: uniqueStudentId,
    phone: '+919876543210',
    password: 'Password@123',
    role: 'STUDENT',
    hostelId: selectedHostel._id,
    blockId: selectedBlock._id,
    floorId: selectedFloor._id,
    roomId: selectedRoom._id,
  };

  const regRes = await fetch(`${BACKEND_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(regPayload),
  });

  assert.equal(regRes.status, 201, 'Student registration must succeed with 201 Created');
  const regBody = await regRes.json();
  assert.equal(regBody.success, true);
  const token = regBody.data.token;
  const user = regBody.data.user;

  assert.equal(user.email, uniqueEmail.toLowerCase());
  assert.equal(String(user.hostelId), String(selectedHostel._id));
  assert.equal(String(user.blockId), String(selectedBlock._id));
  assert.equal(String(user.floorId), String(selectedFloor._id));
  assert.equal(String(user.roomId), String(selectedRoom._id));
  console.log('✓ Registration saved hostelId, blockId, floorId, roomId on student account!');

  // 5. Login & Profile Verification
  console.log('\n8. Authenticating registered student...');
  const loginRes = await fetch(`${BACKEND_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: uniqueEmail,
      password: 'Password@123',
    }),
  });

  assert.equal(loginRes.status, 200);
  const loginBody = await loginRes.json();
  assert.equal(loginBody.success, true);

  console.log('\n9. Fetching Student Profile (/api/auth/me)...');
  const meRes = await fetch(`${BACKEND_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(meRes.status, 200);
  const meBody = await meRes.json();
  const profile = meBody.data.user;

  console.log('Profile Hostel:', profile.hostelId.name);
  console.log('Profile Block:', profile.blockId.name);
  console.log('Profile Floor:', profile.floorId.name || profile.floorId.floorNumber);
  console.log('Profile Room:', profile.roomId.roomNumber);

  assert.equal(profile.hostelId.name, 'BBDU A and B Block');
  assert.equal(profile.blockId.name, '1');
  assert.equal(profile.roomId.roomNumber, selectedRoom.roomNumber);
  console.log('✓ Student profile returns populated allocation details!');

  // 6. Student Dashboard Stats Verification
  console.log('\n10. Fetching Student Dashboard Stats (/api/dashboard/stats)...');
  const dashRes = await fetch(`${BACKEND_URL}/api/dashboard/stats`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(dashRes.status, 200);
  const dashBody = await dashRes.json();
  const dashData = dashBody.data;

  console.log('Dashboard Hostel:', dashData.hostel.name);
  console.log('Dashboard Block:', dashData.block.name);
  console.log('Dashboard Floor:', dashData.floor.name || dashData.floor.floorNumber);
  console.log('Dashboard Room:', dashData.room.roomNumber);

  assert.equal(dashData.hostel.name, 'BBDU A and B Block');
  assert.equal(dashData.block.name, '1');
  assert.equal(dashData.room.roomNumber, selectedRoom.roomNumber);
  console.log('✓ Student Dashboard data displays allocated hostel, block, floor, room!');

  // 7. Submit Complaint Verification with Image Attachment
  console.log('\n11. Submitting maintenance complaint with image attachment...');

  // Create a minimal valid 1x1 PNG image buffer
  const pngBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );

  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  let bodyBuffer = Buffer.alloc(0);

  const appendField = (name, value) => {
    const data = `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`;
    bodyBuffer = Buffer.concat([bodyBuffer, Buffer.from(data)]);
  };

  const appendFile = (name, filename, mimeType, buffer) => {
    const header = `--${boundary}\r\nContent-Disposition: form-data; name="${name}"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`;
    const footer = '\r\n';
    bodyBuffer = Buffer.concat([bodyBuffer, Buffer.from(header), buffer, Buffer.from(footer)]);
  };

  appendField('title', 'Ceiling Fan Vibrating');
  appendField('description', 'The ceiling fan in my room is vibrating excessively and making noise');
  appendField('category', 'ELECTRICAL');
  appendField('issueType', 'FAN_NOT_WORKING');
  appendField('priority', 'MEDIUM');
  appendField('locationDescription', 'Above study desk');
  appendFile('attachment', 'fan_issue.png', 'image/png', pngBuffer);

  bodyBuffer = Buffer.concat([bodyBuffer, Buffer.from(`--${boundary}--\r\n`)]);

  const compRes = await fetch(`${BACKEND_URL}/api/complaints`, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      Authorization: `Bearer ${token}`,
    },
    body: bodyBuffer,
  });

  assert.equal(compRes.status, 201, 'Submit Complaint must succeed with 201 Created');
  const compBody = await compRes.json();
  assert.equal(compBody.success, true);
  const complaint = compBody.data;

  const hostelIdStr = complaint.hostelId?._id ? String(complaint.hostelId._id) : String(complaint.hostelId);
  const roomIdStr = complaint.roomId?._id ? String(complaint.roomId._id) : String(complaint.roomId);

  assert.equal(hostelIdStr, String(selectedHostel._id));
  assert.equal(roomIdStr, String(selectedRoom._id));
  assert.ok(complaint.attachmentUrl, 'Image attachment URL must be returned');

  console.log('✓ Complaint submitted successfully!');
  console.log('✓ Complaint recognized student as allocated (Hostel & Room bound automatically)!');
  console.log('✓ Image attachment uploaded successfully:', complaint.attachmentUrl);

  console.log('\n==================================================');
  console.log('SUCCESS: LIVE RUNTIME VERIFICATION COMPLETED 100%');
  console.log('==================================================');
}

runRuntimeVerification().catch((err) => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
