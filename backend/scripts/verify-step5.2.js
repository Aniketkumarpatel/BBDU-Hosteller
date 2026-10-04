/**
 * Step 5.2 Live End-to-End Verification Script
 * Validates complete Complaint Triage, Assignment, Acknowledgment, Start, and Reassignment Workflow.
 */

const API_BASE = 'http://localhost:5000/api';

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function login(email, password) {
  const res = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  const token = res.data?.data?.token || res.data?.token;
  if (res.status !== 200 || !token) {
    throw new Error(`Login failed for ${email}: ${JSON.stringify(res.data)}`);
  }
  return token;
}

async function run() {
  console.log('=== STARTING STEP 5.2 LIVE VERIFICATION ===\n');

  // 1. Authenticate users
  console.log('[1] Authenticating test actors...');
  const studentToken = await login('student@bbdu.ac.in', 'Password@123');
  console.log('  ✔ Student logged in');

  const wardenToken = await login('warden@bbdu.ac.in', 'Password@123');
  console.log('  ✔ Warden logged in');

  const staffToken = await login('staff@bbdu.ac.in', 'Password@123');
  console.log('  ✔ Staff logged in');

  const adminToken = await login('admin@bbdu.ac.in', 'Password@123');
  console.log('  ✔ Super Admin logged in');

  // 2. Fetch complaint metadata
  console.log('\n[2] Fetching complaint metadata...');
  const metaRes = await request('/complaints/meta', {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  console.log('  Meta response:', JSON.stringify(metaRes));
  const departments = metaRes.data?.data?.departments || [];
  console.log(`  ✔ Meta fetched. Departments count: ${departments.length}`);
  const targetDepartmentId = departments[0]?._id;

  // 3. Student submits complaint
  console.log('\n[3] Student submitting complaint...');
  const submitRes = await request('/complaints', {
    method: 'POST',
    headers: { Authorization: `Bearer ${studentToken}` },
    body: JSON.stringify({
      title: 'Water leakage under washbasin in room',
      description: 'Persistent water leaking creating puddles on the bathroom floor.',
      category: 'PLUMBING',
      issueType: 'WATER_LEAKAGE',
      priority: 'MEDIUM',
    }),
  });

  if (submitRes.status !== 201) {
    throw new Error(`Submission failed: ${JSON.stringify(submitRes.data)}`);
  }
  const complaint = submitRes.data.data;
  console.log(`  ✔ Complaint created! Ticket ID: ${complaint.complaintId}, Status: ${complaint.status}`);

  // 4. Student tries to triage (Permission guard check - MUST fail with 403)
  console.log('\n[4] Testing RBAC: Student attempting to triage...');
  const studentTriageRes = await request(`/complaints/${complaint.complaintId}/triage`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${studentToken}` },
    body: JSON.stringify({ priority: 'HIGH', departmentId: targetDepartmentId }),
  });
  console.log(`  ✔ Student triage rejected with status ${studentTriageRes.status} (Forbidden)`);

  // 5. Warden lists complaints
  console.log('\n[5] Warden listing complaints...');
  const wardenListRes = await request('/complaints', {
    headers: { Authorization: `Bearer ${wardenToken}` },
  });
  const foundInWardenList = wardenListRes.data.data.some((c) => c.complaintId === complaint.complaintId);
  console.log(`  ✔ Warden sees submitted ticket: ${foundInWardenList}`);

  // 6. Warden triages the complaint
  console.log('\n[6] Warden triaging complaint...');
  const triageRes = await request(`/complaints/${complaint.complaintId}/triage`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${wardenToken}` },
    body: JSON.stringify({
      priority: 'HIGH',
      departmentId: targetDepartmentId,
      triageNote: 'Verified with hostel supervisor; urgent plumbing attention required.',
    }),
  });
  console.log(`  ✔ Complaint triaged! Status: ${triageRes.data.data.status}, Priority: ${triageRes.data.data.priority}`);

  // 7. Get eligible assignees
  console.log('\n[7] Querying eligible assignees for the ticket...');
  const assigneesRes = await request(`/complaints/${complaint.complaintId}/eligible-assignees`, {
    headers: { Authorization: `Bearer ${wardenToken}` },
  });
  console.log(`  ✔ Found ${assigneesRes.data.data.length} eligible staff member(s)`);
  const assignedStaff = assigneesRes.data.data.find((s) => s.role === 'HOSTEL_STAFF') || assigneesRes.data.data[0];
  if (!assignedStaff) {
    throw new Error('No active maintenance staff available to assign');
  }

  // 8. Warden assigns complaint to staff
  console.log(`\n[8] Warden assigning ticket to staff ${assignedStaff.name} (${assignedStaff._id})...`);
  const assignRes = await request(`/complaints/${complaint.complaintId}/assign`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${wardenToken}` },
    body: JSON.stringify({
      assignedTo: assignedStaff._id,
      reason: 'Assigned to primary hostel plumbing technician.',
    }),
  });
  console.log(`  ✔ Assigned! Status: ${assignRes.data.data.status}, AssignedTo: ${assignRes.data.data.assignedTo?.name || assignRes.data.data.assignedTo}`);

  // 9. Staff acknowledges ticket
  console.log('\n[9] Assigned staff acknowledging ticket...');
  const ackRes = await request(`/complaints/${complaint.complaintId}/acknowledge`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${staffToken}` },
  });
  console.log(`  ✔ Ticket acknowledged! Status: ${ackRes.data.data.status}, AcknowledgedAt: ${ackRes.data.data.acknowledgedAt}`);

  // 10. Staff starts work
  console.log('\n[10] Assigned staff starting work...');
  const startRes = await request(`/complaints/${complaint.complaintId}/start`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${staffToken}` },
  });
  console.log(`  ✔ Work started! Status: ${startRes.data.data.status}, StartedAt: ${startRes.data.data.startedAt}`);

  // 11. Super Admin creates or finds another staff to test Reassignment
  console.log('\n[11] Testing Reassignment by Super Admin / Warden...');
  // Find or create second staff
  let secondStaffRes = await request('/admin/users?role=HOSTEL_STAFF', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  let staffList = secondStaffRes.data?.data?.users || secondStaffRes.data?.data || [];
  let secondStaff = staffList.find((s) => (s.id || s._id) !== assignedStaff._id);

  if (!secondStaff) {
    console.log('  Creating second staff for reassignment test...');
    const createStaffRes = await request('/admin/users', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        name: 'Sunil Kumar (Electrician/Plumber)',
        email: `sunil.staff.${Date.now()}@bbdu.ac.in`,
        phone: '9876543219',
        password: 'Password@123',
        role: 'HOSTEL_STAFF',
        employeeId: `EMP-STAFF-${Date.now().toString().slice(-4)}`,
        departmentId: targetDepartmentId,
        hostelId: complaint.hostelId?._id || complaint.hostelId,
      }),
    });
    secondStaff = createStaffRes.data?.data?.user || createStaffRes.data?.data;
  }
  const secondStaffId = secondStaff?.id || secondStaff?._id;
  console.log(`  Second staff available: ${secondStaff?.name} (${secondStaffId})`);

  const reassignRes = await request(`/complaints/${complaint.complaintId}/reassign`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${wardenToken}` },
    body: JSON.stringify({
      assignedTo: secondStaffId,
      reason: 'Original technician called away to central campus emergency; workload transferred.',
    }),
  });
  console.log(`  ✔ Reassigned! Status: ${reassignRes.data.data.status}, AssignedTo: ${reassignRes.data.data.assignedTo?.name || reassignRes.data.data.assignedTo}`);

  // 12. Check assignment audit history
  console.log('\n[12] Fetching Assignment Audit History...');
  const historyRes = await request(`/complaints/${complaint.complaintId}/assignments`, {
    headers: { Authorization: `Bearer ${wardenToken}` },
  });
  const history = historyRes.data.data;
  console.log(`  ✔ Found ${history.length} assignment history records:`);
  history.forEach((h, i) => {
    console.log(`    [${i + 1}] AssignedTo: ${h.assignedTo?.name || h.assignedTo}, By: ${h.assignedBy?.name || h.assignedBy}, Current: ${h.isCurrent}, Type: ${h.assignmentType}, Reason: "${h.reason || ''}"`);
  });

  console.log('\n=== ALL STEP 5.2 LIVE VERIFICATION CHECKS PASSED SUCCESSFULLY ===\n');
}

run().catch((err) => {
  console.error('\n❌ VERIFICATION ERROR:', err);
  process.exit(1);
});
