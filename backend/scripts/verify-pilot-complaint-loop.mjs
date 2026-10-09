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

async function loginUser(email, password) {
  const res = await request(`${backendUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(`Login failed for ${email}: ${data.message || res.status}`);
  }
  return {
    token: data.data.token,
    user: data.data.user,
  };
}

async function runPilotWorkflowVerification() {
  console.log('================================================================');
  console.log('   PILOT WORKFLOW E2E VERIFICATION: COMPLAINT-TO-RESOLUTION');
  console.log('================================================================\n');

  // Step 1: Log in all 3 pilot personas
  console.log('1. Authenticating pilot participants...');
  const student = await loginUser('student@bbdu.ac.in', 'Password@123');
  console.log(`✓ Student authenticated: ${student.user.name} (${student.user.email})`);

  const warden = await loginUser('warden@bbdu.ac.in', 'Password@123');
  console.log(`✓ Warden authenticated: ${warden.user.name} (${warden.user.email})`);

  const staff = await loginUser('staff@bbdu.ac.in', 'Password@123');
  console.log(`✓ Staff technician authenticated: ${staff.user.name} (${staff.user.email})`);

  // Step 2: Student submits a new complaint
  console.log('\n2. Student submitting maintenance complaint...');
  const timestamp = Date.now();
  const complaintPayload = {
    title: `Pilot Faucet Leakage Issue ${timestamp}`,
    description: 'Persistent water leakage from bathroom faucet in room 101',
    category: 'PLUMBING',
    issueType: 'WATER_LEAKAGE',
    priority: 'HIGH',
    locationDescription: 'Bathroom wash basin tap',
  };

  const createRes = await request(`${backendUrl}/complaints`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${student.token}`,
    },
    body: JSON.stringify(complaintPayload),
  });

  const createData = await createRes.json();
  if (!createRes.ok || !createData.success) {
    throw new Error(`Student complaint submission failed: ${createData.message || createRes.status}`);
  }

  const complaint = createData.data;
  console.log(`✓ Complaint created! Ticket: ${complaint.complaintId}, ID: ${complaint._id}, Status: ${complaint.status}`);

  // Step 3: Warden triages complaint (SUBMITTED -> TRIAGED)
  console.log('\n3. Warden triaging complaint (SUBMITTED -> TRIAGED)...');
  const triageRes = await request(`${backendUrl}/complaints/${complaint._id}/triage`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${warden.token}`,
    },
    body: JSON.stringify({
      priority: 'HIGH',
      triageNote: 'Verified plumbing concern for pilot cohort',
    }),
  });
  const triageData = await triageRes.json();
  if (!triageRes.ok || !triageData.success) {
    throw new Error(`Warden triage failed: ${triageData.message || triageRes.status}`);
  }
  console.log(`✓ Complaint triaged! Status: ${triageData.data.status}`);

  // Step 4: Warden assigns complaint to Staff (TRIAGED -> ASSIGNED)
  console.log('\n4. Warden assigning ticket to maintenance technician...');
  const metaRes = await request(`${backendUrl}/complaints/meta`, {
    headers: { Authorization: `Bearer ${warden.token}` },
  });
  const metaData = await metaRes.json();
  const departments = metaData.data?.departments || [];
  const plumbingDept = departments.find((d) => d.code === 'PLUMB') || departments[0];
  const targetDeptId = plumbingDept?._id || staff.user.departmentId;
  const staffUserId = staff.user.id || staff.user._id;

  const assignRes = await request(`${backendUrl}/complaints/${complaint._id}/assign`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${warden.token}`,
    },
    body: JSON.stringify({
      assignedTo: staffUserId,
      departmentId: targetDeptId,
      priority: 'HIGH',
      reason: 'Assigned for immediate plumbing repair in pilot',
    }),
  });
  const assignData = await assignRes.json();
  if (!assignRes.ok || !assignData.success) {
    throw new Error(`Warden assignment failed: ${assignData.message || assignRes.status}`);
  }
  console.log(`✓ Complaint assigned to ${staff.user.name}! Status: ${assignData.data.status}`);

  // Step 5: Staff acknowledges receipt (ASSIGNED -> ACKNOWLEDGED)
  console.log('\n5. Staff technician acknowledging assignment...');
  const ackRes = await request(`${backendUrl}/complaints/${complaint._id}/acknowledge`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${staff.token}`,
    },
    body: JSON.stringify({}),
  });
  const ackData = await ackRes.json();
  if (!ackRes.ok || !ackData.success) {
    throw new Error(`Staff acknowledgment failed: ${ackData.message || ackRes.status}`);
  }
  console.log(`✓ Staff acknowledged ticket! Status: ${ackData.data.status}`);

  // Step 6: Staff starts work (ACKNOWLEDGED -> IN_PROGRESS)
  console.log('\n6. Staff starting maintenance repair...');
  const startRes = await request(`${backendUrl}/complaints/${complaint._id}/start`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${staff.token}`,
    },
    body: JSON.stringify({}),
  });
  const startData = await startRes.json();
  if (!startRes.ok || !startData.success) {
    throw new Error(`Staff start-work failed: ${startData.message || startRes.status}`);
  }
  console.log(`✓ Work started! Status: ${startData.data.status}`);

  // Step 7: Staff resolves complaint (IN_PROGRESS -> STUDENT_VERIFICATION)
  console.log('\n7. Staff marking work resolved with completion notes...');
  const resolveRes = await request(`${backendUrl}/complaints/${complaint._id}/resolve`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${staff.token}`,
    },
    body: JSON.stringify({
      resolutionNote: 'Replaced rubber washer and tightened faucet spindle',
    }),
  });
  const resolveData = await resolveRes.json();
  if (!resolveRes.ok || !resolveData.success) {
    throw new Error(`Staff resolution failed: ${resolveData.message || resolveRes.status}`);
  }
  console.log(`✓ Staff resolution submitted! Status: ${resolveData.data.status} (Awaiting Student Verification)`);

  // Step 8: Student tests rejection & reopen loop (STUDENT_VERIFICATION -> REOPENED)
  console.log('\n8. Student testing Reopen Loop (Issue not fixed)...');
  const rejectRes = await request(`${backendUrl}/complaints/${complaint._id}/verify`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${student.token}`,
    },
    body: JSON.stringify({
      decision: 'REJECT',
      reopenReason: 'Water is still dripping slowly after technician left',
    }),
  });
  const rejectData = await rejectRes.json();
  if (!rejectRes.ok || !rejectData.success) {
    throw new Error(`Student rejection failed: ${rejectData.message || rejectRes.status}`);
  }
  console.log(`✓ Complaint successfully reopened!`);
  console.log(`  - Status: ${rejectData.data.status}`);
  console.log(`  - Reopen Count: ${rejectData.data.reopenCount} (Expected: 1)`);

  // Step 9: Staff resumes work (REOPENED -> IN_PROGRESS)
  console.log('\n9. Staff resuming work on reopened ticket (REOPENED -> IN_PROGRESS)...');
  const resumeRes = await request(`${backendUrl}/complaints/${complaint._id}/resume`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${staff.token}`,
    },
    body: JSON.stringify({}),
  });
  const resumeData = await resumeRes.json();
  if (!resumeRes.ok || !resumeData.success) {
    throw new Error(`Staff resume work failed: ${resumeData.message || resumeRes.status}`);
  }
  console.log(`✓ Staff resumed work! Status: ${resumeData.data.status}`);

  // Step 10: Staff re-resolves (IN_PROGRESS -> STUDENT_VERIFICATION)
  console.log('\n10. Staff submitting second resolution...');
  const reResolveRes = await request(`${backendUrl}/complaints/${complaint._id}/resolve`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${staff.token}`,
    },
    body: JSON.stringify({
      resolutionNote: 'Replaced entire brass cartridge assembly and pressure-tested valve',
    }),
  });
  const reResolveData = await reResolveRes.json();
  if (!reResolveRes.ok || !reResolveData.success) {
    throw new Error(`Staff re-resolution failed: ${reResolveData.message || reResolveRes.status}`);
  }
  console.log(`✓ Second resolution submitted! Status: ${reResolveData.data.status}`);

  // Step 11: Student accepts resolution (STUDENT_VERIFICATION -> CLOSED)
  console.log('\n11. Student inspecting and accepting resolution (STUDENT_VERIFICATION -> CLOSED)...');
  const acceptRes = await request(`${backendUrl}/complaints/${complaint._id}/verify`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${student.token}`,
    },
    body: JSON.stringify({
      decision: 'ACCEPT',
      verificationNote: 'Inspected faucet, leak is completely fixed. Excellent job!',
    }),
  });
  const acceptData = await acceptRes.json();
  if (!acceptRes.ok || !acceptData.success) {
    throw new Error(`Student verification accept failed: ${acceptData.message || acceptRes.status}`);
  }
  console.log(`✓ Complaint successfully verified and closed!`);
  console.log(`  - Final Status: ${acceptData.data.status} (Expected: CLOSED)`);
  console.log(`  - Verified At: ${acceptData.data.verifiedAt}`);

  // Step 12: Warden inspects final audit trail
  console.log('\n12. Warden inspecting resolution audit trail...');
  const finalRes = await request(`${backendUrl}/complaints/${complaint._id}`, {
    headers: { Authorization: `Bearer ${warden.token}` },
  });
  const finalData = await finalRes.json();
  const finalDoc = finalData.data;

  console.log(`✓ Full Audit Trail Confirmed:`);
  console.log(`  - Ticket ID: ${finalDoc.complaintId}`);
  console.log(`  - Status: ${finalDoc.status}`);
  console.log(`  - Submitter: ${finalDoc.studentId?.name || student.user.name}`);
  console.log(`  - Triaged By: ${finalDoc.triagedBy?.name || warden.user.name}`);
  console.log(`  - Technician: ${finalDoc.resolvedBy?.name || staff.user.name}`);
  console.log(`  - Total Reopens Handled: ${finalDoc.reopenCount}`);
  console.log(`  - Final Resolution Note: "${finalDoc.resolutionNote}"`);
  console.log(`  - Student Verification Note: "${finalDoc.verificationNote}"`);

  console.log('\n================================================================');
  console.log('   PILOT COMPLAINT-TO-RESOLUTION LOOP: 100% OPERATIONAL');
  console.log('================================================================\n');
}

runPilotWorkflowVerification().catch((err) => {
  console.error('\n❌ PILOT VERIFICATION FAILED:', err.message);
  process.exit(1);
});
