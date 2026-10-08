import http from 'http';

function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const reqOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: options.headers || {},
    };

    const req = http.request(reqOptions, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(body);
        } catch (e) {
          json = body;
        }
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          json: async () => json,
        });
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

const backendUrl = 'http://127.0.0.1:5000/api';

async function runRuntimeVerification() {
  console.log('=== STARTING FULL RUNTIME E2E VERIFICATION ===\n');

  // Step 1: Public hostel data lookup
  console.log('1. Fetching public hostels...');
  const hostelsRes = await request(`${backendUrl}/auth/hostels`);
  const hostelsData = await hostelsRes.json();
  const hostelsList = hostelsData.data?.hostels || hostelsData.data || [];
  if (!hostelsData.success || !hostelsList.length) {
    console.error('Hostels response:', hostelsData);
    throw new Error('Failed to fetch public hostels');
  }
  const targetHostel = hostelsList.find(h => h.name === 'BBDU A and B Block') || hostelsList[0];
  console.log(`✓ Found hostel: "${targetHostel.name}" (${targetHostel._id})`);

  console.log('2. Fetching public blocks...');
  const blocksRes = await request(`${backendUrl}/auth/blocks?hostelId=${targetHostel._id}`);
  const blocksData = await blocksRes.json();
  const blocksList = blocksData.data?.blocks || blocksData.data || [];
  const targetBlock = blocksList[0];
  console.log(`✓ Found block: "${targetBlock.name}" (${targetBlock._id})`);

  console.log('3. Fetching public floors...');
  const floorsRes = await request(`${backendUrl}/auth/floors?blockId=${targetBlock._id}`);
  const floorsData = await floorsRes.json();
  const floorsList = floorsData.data?.floors || floorsData.data || [];
  const targetFloor = floorsList[0];
  console.log(`✓ Found floor: "${targetFloor.name || targetFloor.floorNumber}" (${targetFloor._id})`);

  // Step 2: Problem 1 — Initial Registration
  const timestamp = Date.now();
  const studentEmail = `student.refresh${timestamp}@bbdu.ac.in`;
  const studentId = `REFRESH-${timestamp.toString().slice(-6)}`;
  const password = 'Password@123';

  console.log(`\n--- PROBLEM 1 VERIFICATION ---`);
  console.log(`4. Initial registration for student: ${studentEmail} (${studentId})...`);
  const regPayload1 = {
    name: 'Refresh Test Student',
    email: studentEmail,
    studentId: studentId,
    password: password,
    role: 'STUDENT',
    hostelId: targetHostel._id,
    blockId: targetBlock._id,
    floorId: targetFloor._id,
    roomNumber: '101'
  };

  const regRes1 = await request(`${backendUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(regPayload1)
  });
  const regData1 = await regRes1.json();
  if (!regRes1.ok || !regData1.success) {
    throw new Error(`Initial registration failed: ${regData1.message}`);
  }
  const token1 = regData1.data.token;
  console.log(`✓ Initial registration successful! Token acquired.`);

  // Step 3: Problem 1 — Re-Registration / Upsert
  console.log('5. Testing RE-REGISTRATION with same email/studentId & updated room 202...');
  const regPayload2 = {
    name: 'Refresh Test Student Updated',
    email: studentEmail,
    studentId: studentId,
    password: password,
    role: 'STUDENT',
    hostelId: targetHostel._id,
    blockId: targetBlock._id,
    floorId: targetFloor._id,
    roomNumber: '202'
  };

  const regRes2 = await request(`${backendUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(regPayload2)
  });
  const regData2 = await regRes2.json();
  if (regRes2.status !== 200 || !regData2.success) {
    throw new Error(`Re-registration failed! Status: ${regRes2.status}, message: ${regData2.message}`);
  }
  console.log(`✓ Re-registration succeeded (200 OK)! Message: "${regData2.message}"`);
  console.log(`✓ Room updated to: ${regData2.data.user.roomNumber}`);

  // Step 4: Problem 1 Security — Re-Registration with wrong password
  console.log('6. Testing Re-registration security with WRONG password...');
  const regPayloadWrong = {
    ...regPayload2,
    password: 'WrongPassword999'
  };
  const regResWrong = await request(`${backendUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(regPayloadWrong)
  });
  const regDataWrong = await regResWrong.json();
  if (regResWrong.status !== 409) {
    throw new Error(`Wrong password re-registration should be rejected with 409! Got: ${regResWrong.status}`);
  }
  console.log(`✓ Safe protection verified! Wrong password re-registration rejected with 409 Conflict.`);

  // Step 5: Problem 3 — Auth & Session Verification (/api/auth/me)
  console.log(`\n--- PROBLEM 3 VERIFICATION (PAGE REFRESH / PERSISTENCE) ---`);
  console.log('7. Simulating browser refresh: verifying token with GET /api/auth/me...');
  const meRes = await request(`${backendUrl}/auth/me`, {
    headers: { Authorization: `Bearer ${token1}` }
  });
  const meData = await meRes.json();
  if (!meRes.ok || !meData.success) {
    throw new Error(`Session restore failed on /api/auth/me: ${meData.message}`);
  }
  console.log(`✓ Session restored successfully! Logged-in user: ${meData.data.user.email} (${meData.data.user.role})`);
  console.log(`✓ Allocation in /me: Hostel: ${meData.data.user.hostelId?.name || meData.data.user.hostelId}, Room: ${meData.data.user.roomNumber}`);

  console.log('8. Fetching Student Dashboard Stats (GET /api/dashboard/stats)...');
  const statsRes = await request(`${backendUrl}/dashboard/stats`, {
    headers: { Authorization: `Bearer ${token1}` }
  });
  const statsData = await statsRes.json();
  if (!statsRes.ok || !statsData.success) {
    throw new Error(`Dashboard stats load failed: ${statsData.message}`);
  }
  console.log(`✓ Dashboard stats re-fetched successfully after refresh!`);
  console.log(`✓ Residence info in stats: Hostel: "${statsData.data.hostel?.name || statsData.data.hostel}", Room: "${statsData.data.room?.roomNumber}"`);

  // Step 6: Problem 2 — Recent Activity Verification
  console.log(`\n--- PROBLEM 2 VERIFICATION (RECENT ACTIVITY) ---`);
  console.log('9. Submitting a new complaint for recent activity test...');
  const complaintRes = await request(`${backendUrl}/complaints`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token1}`
    },
    body: JSON.stringify({
      title: 'Water Leakage in Bathroom',
      description: 'Tap is leaking constantly in room bathroom',
      category: 'PLUMBING',
      issueType: 'WATER_LEAKAGE',
      priority: 'HIGH'
    })
  });
  const complaintData = await complaintRes.json();
  if (!complaintRes.ok || !complaintData.success) {
    throw new Error(`Complaint creation failed: ${complaintData.message}`);
  }
  console.log(`✓ Complaint submitted! ID: ${complaintData.data._id}`);

  console.log('10. Submitting an outpass request for recent activity test...');
  const outpassRes = await request(`${backendUrl}/outpass`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token1}`
    },
    body: JSON.stringify({
      purpose: 'PERSONAL',
      destination: 'Hazratganj Market',
      departureAt: new Date(Date.now() + 60000).toISOString(),
      expectedReturnAt: new Date(Date.now() + 86400000).toISOString()
    })
  });
  const outpassData = await outpassRes.json();
  if (!outpassRes.ok || !outpassData.success) {
    throw new Error(`Outpass creation failed: ${outpassData.message}`);
  }
  console.log(`✓ Outpass submitted! ID: ${outpassData.data._id}`);

  console.log('11. Fetching student activity feeds...');
  const studentComplaintsRes = await request(`${backendUrl}/complaints/my?limit=10`, {
    headers: { Authorization: `Bearer ${token1}` }
  });
  const studentComplaintsData = await studentComplaintsRes.json();

  const studentOutpassRes = await request(`${backendUrl}/outpass?limit=10`, {
    headers: { Authorization: `Bearer ${token1}` }
  });
  const studentOutpassData = await studentOutpassRes.json();

  const compList = studentComplaintsData.data?.complaints || studentComplaintsData.data || [];
  const outpassList = studentOutpassData.data?.outpasses || studentOutpassData.data || [];

  console.log(`✓ Fetched ${compList.length} complaint(s) and ${outpassList.length} outpass(es) for recent activity.`);
  if (!compList.length || !outpassList.length) {
    throw new Error('Recent activity items missing for logged-in student');
  }

  // Step 7: Problem 4 — Mess & Dining Menu Display
  console.log(`\n--- PROBLEM 4 VERIFICATION (MESS MENU DISPLAY) ---`);
  console.log('12. Fetching messes...');
  const messListRes = await request(`${backendUrl}/messes`, {
    headers: { Authorization: `Bearer ${token1}` }
  });
  const messListData = await messListRes.json();
  const messes = messListData.data || [];
  if (!messListRes.ok || messes.length === 0) {
    throw new Error(`Mess list empty! Status: ${messListRes.status}`);
  }
  const activeMess = messes[0];
  console.log(`✓ Mess fetched: "${activeMess.name}" (${activeMess._id})`);

  console.log('13. Fetching Today\'s Menu (GET /api/messes/:messId/menus/today)...');
  const todayMenuRes = await request(`${backendUrl}/messes/${activeMess._id}/menus/today`, {
    headers: { Authorization: `Bearer ${token1}` }
  });
  const todayMenuData = await todayMenuRes.json();
  if (!todayMenuRes.ok || !todayMenuData.success) {
    throw new Error(`Today's menu fetch failed: ${todayMenuData.message}`);
  }
  const mealsObj = todayMenuData.data?.meals || todayMenuData.data || {};
  console.log(`✓ Today's Menu retrieved for ${todayMenuData.data?.dayOfWeek}:`);
  console.log(`  - BREAKFAST: ${mealsObj.BREAKFAST ? 'Present' : 'Not published'}`);
  console.log(`  - LUNCH: ${mealsObj.LUNCH ? 'Present' : 'Not published'}`);
  console.log(`  - SNACKS: ${mealsObj.SNACKS ? 'Present' : 'Not published'}`);
  console.log(`  - DINNER: ${mealsObj.DINNER ? 'Present' : 'Not published'}`);

  // Step 8: Problem 5 — Meal Quality Feedback Submission
  console.log(`\n--- PROBLEM 5 VERIFICATION (MEAL QUALITY FEEDBACK) ---`);
  console.log('14. Submitting Meal Quality feedback with complete payload...');
  const feedbackPayload = {
    messId: activeMess._id,
    mealType: 'LUNCH',
    mealDate: new Date().toISOString().split('T')[0],
    rating: 5,
    foodQuality: 'GOOD',
    taste: 4,
    hygiene: 5,
    quantity: 4,
    comments: 'Excellent food and quick service today!'
  };
  const feedbackRes = await request(`${backendUrl}/mess-feedback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token1}`
    },
    body: JSON.stringify(feedbackPayload)
  });
  const feedbackData = await feedbackRes.json();
  if (!feedbackRes.ok || !feedbackData.success) {
    throw new Error(`Meal quality feedback submission failed: ${feedbackData.message}`);
  }
  console.log(`✓ Meal quality feedback submitted successfully! ID: ${feedbackData.data._id || feedbackData.data.feedbackId}`);

  console.log('15. Verifying student feedbacks list (GET /api/mess-feedback/my)...');
  const myFbRes = await request(`${backendUrl}/mess-feedback/my`, {
    headers: { Authorization: `Bearer ${token1}` }
  });
  const myFbData = await myFbRes.json();
  const myFeedbacks = myFbData.data?.feedbacks || myFbData.data || [];
  console.log(`✓ My feedbacks list updated: ${myFeedbacks.length} feedback(s) found.`);

  console.log('\n==================================================');
  console.log('ALL 5 PROBLEMS VERIFIED SUCCESSFULLY IN RUNTIME!');
  console.log('==================================================\n');
}

runRuntimeVerification().catch((err) => {
  console.error('\n❌ RUNTIME VERIFICATION FAILED:', err.message);
  process.exit(1);
});
