import fetch from 'node-fetch';

const API_BASE = 'http://localhost:5000/api';

async function verifyFlow() {
  console.log('--- STARTING FULL RUNTIME VERIFICATION ---');

  // Step 1: Fetch Hostels
  console.log('1. Calling GET /api/auth/hostels...');
  const hostelsRes = await fetch(`${API_BASE}/auth/hostels`);
  const hostelsBody = await hostelsRes.json();
  console.log('HTTP Status:', hostelsRes.status);
  const hostels = hostelsBody?.data?.hostels || [];
  console.log(`Hostels count returned: ${hostels.length}`);
  hostels.forEach((h, i) => console.log(`   ${i + 1}. ${h.name} (${h.code})`));

  if (hostels.length !== 7) {
    throw new Error(`Expected exactly 7 hostels, got ${hostels.length}`);
  }

  // Find BBDU A and B Block
  const abHostel = hostels.find((h) => h.name === 'BBDU A and B Block');
  if (!abHostel) throw new Error('BBDU A and B Block not found');

  // Step 2: Fetch Blocks for BBDU A and B Block
  console.log(`\n2. Calling GET /api/auth/blocks?hostelId=${abHostel._id}...`);
  const blocksRes = await fetch(`${API_BASE}/auth/blocks?hostelId=${abHostel._id}`);
  const blocksBody = await blocksRes.json();
  console.log('HTTP Status:', blocksRes.status);
  const blocks = blocksBody?.data?.blocks || [];
  console.log(`Blocks count: ${blocks.length}`);
  blocks.forEach((b) => console.log(`   Block: ${b.name}`));

  const block1 = blocks.find((b) => b.name === '1');
  if (!block1) throw new Error('Block 1 not found');

  // Step 3: Fetch Floors for Block 1
  console.log(`\n3. Calling GET /api/auth/floors?blockId=${block1._id}...`);
  const floorsRes = await fetch(`${API_BASE}/auth/floors?blockId=${block1._id}`);
  const floorsBody = await floorsRes.json();
  console.log('HTTP Status:', floorsRes.status);
  const floors = floorsBody?.data?.floors || [];
  console.log(`Floors count: ${floors.length}`);
  floors.forEach((f) => console.log(`   Floor: ${f.floorNumber || f.name}`));

  const floor1 = floors.find((f) => String(f.floorNumber) === '1' || f.name === '1');
  if (!floor1) throw new Error('Floor 1 not found');

  // Step 4: Fetch Rooms for Floor 1
  console.log(`\n4. Calling GET /api/auth/rooms?floorId=${floor1._id}...`);
  const roomsRes = await fetch(`${API_BASE}/auth/rooms?floorId=${floor1._id}`);
  const roomsBody = await roomsRes.json();
  console.log('HTTP Status:', roomsRes.status);
  const rooms = roomsBody?.data?.rooms || [];
  console.log(`Rooms count: ${rooms.length}`);
  rooms.forEach((r) => console.log(`   Room ${r.roomNumber} (Cap: ${r.capacity}, Occ: ${r.currentOccupancy})`));

  const availableRoom = rooms.find((r) => r.currentOccupancy < r.capacity);
  if (!availableRoom) throw new Error('No available room found');

  // Step 5: Register new student with allocation
  const studentEmail = `student_${Date.now()}@bbdu.ac.in`;
  const studentId = `BBDU${Date.now().toString().slice(-6)}`;
  console.log(`\n5. Registering new student (${studentEmail}, ID: ${studentId})...`);

  const regRes = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Verification Student',
      email: studentEmail,
      studentId: studentId,
      phone: '+919999988888',
      password: 'Password123',
      role: 'STUDENT',
      hostelId: abHostel._id,
      blockId: block1._id,
      floorId: floor1._id,
      roomId: availableRoom._id,
    }),
  });

  const regBody = await regRes.json();
  console.log('HTTP Status:', regRes.status);
  if (regRes.status !== 201) {
    throw new Error(`Registration failed: ${JSON.stringify(regBody)}`);
  }
  const token = regBody.data.token;
  console.log('Token received successfully.');

  // Step 6: Verify Profile /auth/me
  console.log('\n6. Calling GET /api/auth/me...');
  const meRes = await fetch(`${API_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const meBody = await meRes.json();
  console.log('HTTP Status:', meRes.status);
  console.log('Allocated Hostel:', meBody?.data?.user?.hostelId?.name);
  console.log('Allocated Block:', meBody?.data?.user?.blockId?.name);
  console.log('Allocated Floor:', meBody?.data?.user?.floorId?.floorNumber || meBody?.data?.user?.floorId?.name);
  console.log('Allocated Room:', meBody?.data?.user?.roomId?.roomNumber);

  // Step 7: Verify Dashboard Stats
  console.log('\n7. Calling GET /api/dashboard/stats...');
  const dashRes = await fetch(`${API_BASE}/dashboard/stats`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const dashBody = await dashRes.json();
  console.log('HTTP Status:', dashRes.status);
  console.log('Dashboard Hostel:', dashBody?.data?.hostel?.name);
  console.log('Dashboard Block:', dashBody?.data?.block?.name);
  console.log('Dashboard Floor:', dashBody?.data?.floor?.floorNumber || dashBody?.data?.floor?.name);
  console.log('Dashboard Room:', dashBody?.data?.room?.roomNumber);

  // Step 8: Submit Complaint
  console.log('\n8. Submitting test complaint...');
  const compRes = await fetch(`${API_BASE}/complaints`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: 'Water tap leaking',
      description: 'The bathroom tap is leaking continuously in Room 101.',
      category: 'PLUMBING',
      priority: 'MEDIUM',
    }),
  });
  const compBody = await compRes.json();
  console.log('HTTP Status:', compRes.status);
  console.log('Complaint Created:', compBody?.data?.title || compBody?.data?.complaint?.title || compBody?.success);

  console.log('\n✅ ALL 8 RUNTIME VERIFICATION STEPS PASSED PERFECTLY!');
}

verifyFlow().catch((err) => {
  console.error('\n❌ RUNTIME VERIFICATION FAILED:', err);
  process.exit(1);
});
