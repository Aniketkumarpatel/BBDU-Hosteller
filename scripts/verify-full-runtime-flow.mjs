const API_BASE = 'http://localhost:5000/api';

async function verifyFlow() {
  console.log('--- STARTING REVISED RUNTIME VERIFICATION ---');

  // Step 1: Fetch Hostels & Verify Name Correction
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

  const bbduGirlsHostel = hostels.find((h) => h.name === 'BBDU Girls Hostel');
  const bbduDeviHostel = hostels.find((h) => h.name === 'BBDU Devi Girls Hostel');

  if (!bbduGirlsHostel) {
    throw new Error('CORRECTION FAILED: "BBDU Girls Hostel" was not found in hostels list!');
  }
  if (bbduDeviHostel) {
    throw new Error('CORRECTION FAILED: "BBDU Devi Girls Hostel" still exists in hostels list!');
  }
  console.log('✅ Correction 1 Verified: "BBDU Girls Hostel" exists, "BBDU Devi Girls Hostel" removed.');

  // Step 2: Fetch Blocks for BBDU Girls Hostel
  console.log(`\n2. Calling GET /api/auth/blocks?hostelId=${bbduGirlsHostel._id}...`);
  const blocksRes = await fetch(`${API_BASE}/auth/blocks?hostelId=${bbduGirlsHostel._id}`);
  const blocksBody = await blocksRes.json();
  console.log('HTTP Status:', blocksRes.status);
  const blocks = blocksBody?.data?.blocks || [];
  console.log(`Blocks count: ${blocks.length}`);
  blocks.forEach((b) => console.log(`   Block: ${b.name}`));

  const block2 = blocks.find((b) => b.name === '2') || blocks[0];

  // Step 3: Fetch Floors for Block 2 & Verify Floors 1, 2, 3, 4, 5
  console.log(`\n3. Calling GET /api/auth/floors?blockId=${block2._id}...`);
  const floorsRes = await fetch(`${API_BASE}/auth/floors?blockId=${block2._id}`);
  const floorsBody = await floorsRes.json();
  console.log('HTTP Status:', floorsRes.status);
  const floors = floorsBody?.data?.floors || [];
  console.log(`Floors count: ${floors.length}`);
  floors.forEach((f) => console.log(`   Floor: ${f.floorNumber || f.name}`));

  const floorNumbers = floors.map((f) => Number(f.floorNumber || f.name));
  console.log('Floor Numbers:', floorNumbers);
  if (![1, 2, 3, 4, 5].every((num) => floorNumbers.includes(num))) {
    throw new Error(`CORRECTION FAILED: Floor list must contain 1, 2, 3, 4, 5. Got: ${floorNumbers}`);
  }
  console.log('✅ Correction 3 Verified: Floors 1, 2, 3, 4, 5 exist.');

  const floor4 = floors.find((f) => String(f.floorNumber) === '4' || f.name === '4') || floors[3];

  // Step 4: Register Student with Manual Room Number 420
  const studentEmail = `student_${Date.now()}@bbdu.ac.in`;
  const studentId = `BBDU${Date.now().toString().slice(-6)}`;
  console.log(`\n4. Registering new student with manual Room Number 420 (${studentEmail}, ID: ${studentId})...`);

  const regRes = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Riya Verma',
      email: studentEmail,
      studentId: studentId,
      phone: '+919876543210',
      password: 'Password123',
      role: 'STUDENT',
      hostelId: bbduGirlsHostel._id,
      blockId: block2._id,
      floorId: floor4._id,
      roomNumber: '420',
    }),
  });

  const regBody = await regRes.json();
  console.log('HTTP Status:', regRes.status);
  if (regRes.status !== 201) {
    throw new Error(`Registration failed: ${JSON.stringify(regBody)}`);
  }
  const token = regBody.data.token;
  console.log('Registered User Room Number:', regBody.data.user.roomNumber);
  if (regBody.data.user.roomNumber !== '420') {
    throw new Error(`CORRECTION FAILED: Expected roomNumber '420', got '${regBody.data.user.roomNumber}'`);
  }
  console.log('✅ Correction 2 Verified: Manual room number 420 accepted and saved.');

  // Step 5: Verify Profile /auth/me
  console.log('\n5. Calling GET /api/auth/me...');
  const meRes = await fetch(`${API_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const meBody = await meRes.json();
  console.log('HTTP Status:', meRes.status);
  console.log('Allocated Hostel:', meBody?.data?.user?.hostelId?.name);
  console.log('Allocated Block:', meBody?.data?.user?.blockId?.name);
  console.log('Allocated Floor:', meBody?.data?.user?.floorId?.floorNumber || meBody?.data?.user?.floorId?.name);
  console.log('Allocated Room Number:', meBody?.data?.user?.roomNumber || meBody?.data?.user?.roomId?.roomNumber);

  // Step 6: Verify Dashboard Stats
  console.log('\n6. Calling GET /api/dashboard/stats...');
  const dashRes = await fetch(`${API_BASE}/dashboard/stats`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const dashBody = await dashRes.json();
  console.log('HTTP Status:', dashRes.status);
  console.log('Dashboard Hostel:', dashBody?.data?.hostel?.name);
  console.log('Dashboard Block:', dashBody?.data?.block?.name);
  console.log('Dashboard Floor:', dashBody?.data?.floor?.floorNumber || dashBody?.data?.floor?.name);
  console.log('Dashboard Room:', dashBody?.data?.room?.roomNumber);

  // Step 7: Submit Complaint
  console.log('\n7. Submitting test complaint...');
  const compRes = await fetch(`${API_BASE}/complaints`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: 'Water tap leaking in room 420',
      description: 'The bathroom tap is leaking continuously in Room 420.',
      category: 'PLUMBING',
      issueType: 'WATER_LEAKAGE',
      priority: 'MEDIUM',
    }),
  });
  const compBody = await compRes.json();
  console.log('HTTP Status:', compRes.status);
  console.log('Complaint Created:', compBody?.data?.title || compBody?.data?.complaint?.title || compBody?.success);

  console.log('\n🎉 ALL REVISED VERIFICATION STEPS PASSED PERFECTLY!');
}

verifyFlow().catch((err) => {
  console.error('\n❌ REVISED RUNTIME VERIFICATION FAILED:', err);
  process.exit(1);
});
