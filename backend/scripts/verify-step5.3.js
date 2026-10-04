import fetch from 'node:test';

const BASE_URL = 'http://localhost:5000/api';

const login = async (email, password = 'Password@123') => {
  const res = await globalThis.fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Login failed for ${email}: ${data.message}`);
  return { token: data.data.token, user: data.data.user };
};

const run = async () => {
  console.log('=== Step 5.3 Live E2E Workflow Verification ===\n');

  // 1. Authenticate actors
  console.log('1. Authenticating actors...');
  const student = await login('student@bbdu.ac.in');
  const warden = await login('warden@bbdu.ac.in');
  const staff = await login('staff@bbdu.ac.in');
  console.log('   Authenticated: Student (Aarav), Warden (Boys Hostel), Staff (Ramesh)\n');

  // 2. Student files complaint
  console.log('2. Student Submits Complaint...');
  const createRes = await globalThis.fetch(`${BASE_URL}/complaints`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${student.token}`,
    },
    body: JSON.stringify({
      title: 'Geyser Power Switch Sparking and Tripping',
      description: 'The geyser power switch socket in the bathroom sparks and trips the MCB whenever switched on.',
      category: 'ELECTRICAL',
      issueType: 'SWITCH_SOCKET_ISSUE',
      priority: 'HIGH',
      locationDescription: 'Bathroom 101',
    }),
  });
  const createData = await createRes.json();
  if (!createRes.ok) throw new Error(createData.message);
  const complaintId = createData.data.complaintId;
  console.log(`   Created complaint ${complaintId} with status: ${createData.data.status}\n`);

  // 3. Warden Triages Complaint
  console.log('3. Warden Triages Complaint...');
  const triageRes = await globalThis.fetch(`${BASE_URL}/complaints/${complaintId}/triage`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${warden.token}`,
    },
    body: JSON.stringify({
      priority: 'CRITICAL',
      triageNote: 'Tripped MCB confirmed. High electrical fire hazard; marked CRITICAL.',
    }),
  });
  const triageData = await triageRes.json();
  if (!triageRes.ok) throw new Error(triageData.message);
  console.log(`   Triaged ${complaintId}: status=${triageData.data.status}, priority=${triageData.data.priority}\n`);

  // Fetch department
  const deptsRes = await globalThis.fetch(`${BASE_URL}/admin/departments`, {
    headers: { Authorization: `Bearer ${warden.token}` },
  });
  const deptsData = await deptsRes.json();
  const deptId = staff.user.departmentId?._id || staff.user.departmentId || deptsData.data?.[0]?._id;

  const staffId = staff.user.id || staff.user._id;
  console.log(`   Staff User ID: ${staffId}`);

  // 4. Warden Assigns to Staff
  console.log('4. Warden Assigns to Maintenance Staff Ramesh...');
  const assignRes = await globalThis.fetch(`${BASE_URL}/complaints/${complaintId}/assign`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${warden.token}`,
    },
    body: JSON.stringify({
      departmentId: deptId,
      assignedTo: staffId,
      reason: 'Assigned to duty electrician for geyser switch replacement.',
    }),
  });
  const assignData = await assignRes.json();
  if (!assignRes.ok) throw new Error(assignData.message);
  console.log(`   Assigned ${complaintId}: status=${assignData.data.status}, assignedTo=${assignData.data.assignedTo?.name}\n`);

  // 5. Staff Acknowledges
  console.log('5. Staff Acknowledges Complaint...');
  const ackRes = await globalThis.fetch(`${BASE_URL}/complaints/${complaintId}/acknowledge`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${staff.token}`,
    },
  });
  const ackData = await ackRes.json();
  if (!ackRes.ok) throw new Error(ackData.message);
  console.log(`   Acknowledged ${complaintId}: status=${ackData.data.status}, acknowledgedAt=${ackData.data.acknowledgedAt}\n`);

  // 6. Staff Starts Work
  console.log('6. Staff Starts Work...');
  const startRes = await globalThis.fetch(`${BASE_URL}/complaints/${complaintId}/start`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${staff.token}`,
    },
  });
  const startData = await startRes.json();
  if (!startRes.ok) throw new Error(startData.message);
  console.log(`   Started work on ${complaintId}: status=${startData.data.status}, startedAt=${startData.data.startedAt}\n`);

  // 7. Staff Resolves Complaint (Attempt 1)
  console.log('7. Staff Submits Resolution (Attempt 1)...');
  const resolve1Res = await globalThis.fetch(`${BASE_URL}/complaints/${complaintId}/resolve`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${staff.token}`,
    },
    body: JSON.stringify({
      resolutionNote: 'Replaced the 2000W heating element and reset the thermostat. Power light turns on.',
    }),
  });
  const resolve1Data = await resolve1Res.json();
  if (!resolve1Res.ok) throw new Error(resolve1Data.message);
  console.log(`   Resolved ${complaintId}: status=${resolve1Data.data.status}`);
  console.log(`   Resolution Note: "${resolve1Data.data.resolutionNote}"`);
  console.log(`   Verification Requested At: ${resolve1Data.data.verificationRequestedAt}\n`);

  // 8. Student Rejects Resolution (Reopens Complaint)
  console.log('8. Student Verifies: Reject & Reopen...');
  const rejectRes = await globalThis.fetch(`${BASE_URL}/complaints/${complaintId}/verify`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${student.token}`,
    },
    body: JSON.stringify({
      decision: 'REJECT',
      reopenReason: 'Water does not get warm even after 20 minutes; thermostat seems improperly calibrated.',
    }),
  });
  const rejectData = await rejectRes.json();
  if (!rejectRes.ok) throw new Error(rejectData.message);
  console.log(`   Reopened ${complaintId}: status=${rejectData.data.status}, reopenCount=${rejectData.data.reopenCount}`);
  console.log(`   Reopen Reason: "${rejectData.data.reopenReason}"`);
  console.log(`   Assigned To Preserved: ${rejectData.data.assignedTo?.name || rejectData.data.assignedTo}\n`);

  // 9. Staff Resumes Work
  console.log('9. Staff Resumes Work on Reopened Complaint...');
  const resumeRes = await globalThis.fetch(`${BASE_URL}/complaints/${complaintId}/resume`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${staff.token}`,
    },
  });
  const resumeData = await resumeRes.json();
  if (!resumeRes.ok) throw new Error(resumeData.message);
  console.log(`   Resumed ${complaintId}: status=${resumeData.data.status}, startedAt=${resumeData.data.startedAt}\n`);

  // 10. Staff Resolves Complaint (Attempt 2)
  console.log('10. Staff Submits Second Resolution...');
  const resolve2Res = await globalThis.fetch(`${BASE_URL}/complaints/${complaintId}/resolve`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${staff.token}`,
    },
    body: JSON.stringify({
      resolutionNote: 'Adjusted and calibrated thermostat cut-off temperature to 65C. Heated water tested in presence of student.',
    }),
  });
  const resolve2Data = await resolve2Res.json();
  if (!resolve2Res.ok) throw new Error(resolve2Data.message);
  console.log(`   Resolved (Attempt 2) ${complaintId}: status=${resolve2Data.data.status}`);
  console.log(`   Resolution Note: "${resolve2Data.data.resolutionNote}"\n`);

  // 11. Student Verifies: Accept & Close
  console.log('11. Student Verifies: Accept Resolution & Close Complaint...');
  const acceptRes = await globalThis.fetch(`${BASE_URL}/complaints/${complaintId}/verify`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${student.token}`,
    },
    body: JSON.stringify({
      decision: 'ACCEPT',
      verificationNote: 'Geyser is now heating perfectly and water is hot in 10 minutes. Issue resolved!',
    }),
  });
  const acceptData = await acceptRes.json();
  if (!acceptRes.ok) throw new Error(acceptData.message);
  console.log(`   Closed ${complaintId}: status=${acceptData.data.status}`);
  console.log(`   Verified By: ${acceptData.data.verifiedBy?.name || acceptData.data.verifiedBy}`);
  console.log(`   Closed At: ${acceptData.data.closedAt}`);
  console.log(`   Verification Note: "${acceptData.data.verificationNote}"\n`);

  // 12. Query Full Resolution History
  console.log('12. Querying Chronological Resolution Audit History...');
  const historyRes = await globalThis.fetch(`${BASE_URL}/complaints/${complaintId}/resolutions`, {
    headers: {
      Authorization: `Bearer ${student.token}`,
    },
  });
  const historyData = await historyRes.json();
  if (!historyRes.ok) throw new Error(historyData.message);
  console.log(`   Total Resolution Cycles: ${historyData.count}`);
  historyData.data.forEach((cycle) => {
    console.log(`   - Cycle #${cycle.attemptNumber}:`);
    console.log(`     Resolved by: ${cycle.resolvedBy?.name} with note: "${cycle.resolutionNote}"`);
    console.log(`     Decision: ${cycle.verificationDecision} by: ${cycle.verifiedBy?.name}`);
    if (cycle.reopened) {
      console.log(`     Reopen Reason: "${cycle.reopenReason}"`);
    } else {
      console.log(`     Verification Note: "${cycle.verificationNote}"`);
    }
  });

  console.log('\nSUCCESS! Step 5.3 complaint resolution, verification, reopen, and resume lifecycle fully verified.');
};

run().catch((err) => {
  console.error('\nFAILURE:', err);
  process.exit(1);
});
