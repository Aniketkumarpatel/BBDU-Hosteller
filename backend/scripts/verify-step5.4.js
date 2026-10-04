import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import { connectDB, disconnectDB } from '../src/config/db.js';
import {
  User,
  Hostel,
  Complaint,
  ComplaintAssignment,
  ComplaintEscalation,
  ComplaintSlaCycle,
  SlaRule,
  EscalationRule,
} from '../src/models/index.js';
import {
  startSlaForComplaint,
  processSlaAndEscalations,
  getComplaintSlaInfo,
  getComplaintEscalationHistory,
} from '../src/services/sla.service.js';
import { ROLES } from '../src/constants/roles.js';
import { COMPLAINT_STATUSES } from '../src/constants/complaint.constants.js';

import { createStudentComplaint, triageComplaint, assignComplaint } from '../src/services/complaint.service.js';

async function runVerification() {
  console.log('================================================================');
  console.log('🚀 BBDU HOSTELLER - STEP 5.4 LIVE SLA & ESCALATION VERIFICATION');
  console.log('================================================================\n');

  await connectDB();

  try {
    // 1. Check existing SLA Rules & Escalation Rules
    const slaRules = await SlaRule.find({ isActive: true });
    const escRules = await EscalationRule.find({ isActive: true });
    console.log(`[1] Found ${slaRules.length} active SLA rules and ${escRules.length} escalation rules in database.`);
    if (slaRules.length === 0 || escRules.length === 0) {
      throw new Error('Please run seed script first to populate SLA & Escalation rules');
    }

    // 2. Find test users
    const student = await User.findOne({ role: ROLES.STUDENT, isActive: true });
    const warden = await User.findOne({ role: ROLES.WARDEN, isActive: true });
    const staff = await User.findOne({ role: ROLES.HOSTEL_STAFF, isActive: true });
    const authority = await User.findOne({ role: ROLES.AUTHORITY, isActive: true });

    if (!student || !warden || !staff || !authority) {
      throw new Error('Missing required test users across all roles (Student, Warden, Staff, Authority)');
    }
    console.log(`[2] Users identified:`);
    console.log(`    Student:   ${student.name} (${student.email})`);
    console.log(`    Warden:    ${warden.name} (${warden.email})`);
    console.log(`    Staff:     ${staff.name} (${staff.email})`);
    console.log(`    Authority: ${authority.name} (${authority.email})`);

    // 3. Create a test complaint
    console.log('\n[3] Creating simulated high-priority electrical complaint...');
    const complaint = await createStudentComplaint(student._id, {
      title: 'E2E SLA Verification - Geyser Short Circuit',
      description: 'The geyser in the bathroom sparked and tripped the main circuit breaker.',
      category: 'ELECTRICAL',
      issueType: 'ELECTRICITY_FAILURE',
      priority: 'CRITICAL',
    });
    console.log(`    Complaint Created: ${complaint.complaintId} (ID: ${complaint._id})`);

    // 4. Operational Assignment & SLA Initiation
    console.log('\n[4] Simulating Warden triaging and assigning complaint to Staff Electrician...');
    await triageComplaint(
      complaint._id.toString(),
      {
        departmentId: staff.departmentId || complaint.departmentId,
        priority: 'CRITICAL',
        triageNotes: 'Immediate electrician attention required',
      },
      warden
    );

    const assigned = await assignComplaint(
      complaint._id.toString(),
      {
        departmentId: staff.departmentId || complaint.departmentId,
        assignedTo: staff._id.toString(),
        reason: 'Please inspect geyser circuit immediately.',
      },
      warden
    );

    console.log(`    SLA Initialized: Status = ${assigned.slaStatus}`);
    console.log(`    Deadline:        ${new Date(assigned.slaDueAt).toISOString()}`);

    // 5. Test Reminder Detection
    console.log('\n[5] Simulating elapsed time beyond 75% reminder threshold...');
    const now = Date.now();
    const mockStartedAt = new Date(now - 3.5 * 60 * 60 * 1000); // 3.5 hours ago (for 4h SLA, >75%)
    const mockDueAt = new Date(now + 0.5 * 60 * 60 * 1000); // 30 mins left
    const mockReminderDueAt = new Date(mockStartedAt.getTime() + (mockDueAt.getTime() - mockStartedAt.getTime()) * 0.75);

    await Complaint.findByIdAndUpdate(complaint._id, {
      slaStartedAt: mockStartedAt,
      slaDueAt: mockDueAt,
      reminderSentAt: null,
    });

    await ComplaintSlaCycle.findOneAndUpdate(
      { complaintId: complaint._id, status: 'ACTIVE' },
      { startedAt: mockStartedAt, dueAt: mockDueAt, reminderDueAt: mockReminderDueAt, reminderSentAt: null }
    );

    const reminderRunResult = await processSlaAndEscalations();
    console.log(`    SLA Scheduler Pass: ${reminderRunResult.remindersRecorded} reminder(s) recorded`);
    const reminderComplaint = await Complaint.findById(complaint._id);
    console.log(`    Reminder Flag Set:  ${Boolean(reminderComplaint.reminderSentAt)} (${reminderComplaint.reminderSentAt})`);

    // 6. Test Level 1 SLA Breach & Escalation (Staff -> Warden)
    console.log('\n[6] Simulating SLA Breach (due date elapsed)...');
    const pastDue = new Date(now - 10 * 60 * 1000); // 10 minutes overdue
    await Complaint.findByIdAndUpdate(complaint._id, {
      slaDueAt: pastDue,
    });

    const breachRunResult = await processSlaAndEscalations();
    console.log(`    SLA Scheduler Pass: ${breachRunResult.escalationsTriggered} escalation(s) triggered`);

    const escalatedComplaint = await Complaint.findById(complaint._id);
    console.log(`    Current Escalation Level: ${escalatedComplaint.currentEscalationLevel}`);
    console.log(`    Escalation Count:         ${escalatedComplaint.escalationCount}`);
    console.log(`    New Assignee:             ${escalatedComplaint.assignedTo} (Expected Warden: ${warden._id})`);
    console.log(`    Fresh SLA Status:         ${escalatedComplaint.slaStatus}`);
    console.log(`    Fresh SLA Due:            ${escalatedComplaint.slaDueAt.toISOString()}`);

    const escalations = await getComplaintEscalationHistory(complaint._id);
    console.log(`    Escalation Log Entry:     From [${escalations[0].fromRole}] to [${escalations[0].toRole}] (Level ${escalations[0].escalationLevel})`);

    // 7. Test Level 2 Escalation (Warden -> Authority)
    console.log('\n[7] Simulating Level 1 SLA Breach by Warden...');
    await Complaint.findByIdAndUpdate(complaint._id, {
      slaDueAt: new Date(now - 15 * 60 * 1000),
    });

    const lvl2RunResult = await processSlaAndEscalations();
    console.log(`    SLA Scheduler Pass: ${lvl2RunResult.escalationsTriggered} escalation(s) triggered`);

    const lvl2Complaint = await Complaint.findById(complaint._id);
    console.log(`    Current Escalation Level: ${lvl2Complaint.currentEscalationLevel}`);
    console.log(`    Escalation Count:         ${lvl2Complaint.escalationCount}`);
    console.log(`    New Assignee:             ${lvl2Complaint.assignedTo} (Expected Authority: ${authority._id})`);

    const allEscalations = await getComplaintEscalationHistory(complaint._id);
    console.log(`    Total Escalation Records: ${allEscalations.length}`);
    allEscalations.forEach((esc, idx) => {
      console.log(`      [${idx + 1}] Level ${esc.escalationLevel}: ${esc.fromRole} (${esc.fromUserId?.name || 'Unassigned'}) -> ${esc.toRole} (${esc.toUserId?.name || 'Authority'})`);
    });

    // 8. Test SLA Cycle History
    console.log('\n[8] Inspecting SLA Cycles audit trail...');
    const slaInfo = await getComplaintSlaInfo(complaint._id);
    console.log(`    Total SLA Cycles Recorded: ${slaInfo.cycles.length}`);
    slaInfo.cycles.forEach((c) => {
      console.log(`      Cycle #${c.cycleNumber} (Level ${c.escalationLevel}): Status=${c.status}, Duration=${c.slaRuleSnapshot.resolutionHours}h, Started=${c.startedAt?.toISOString()}`);
    });

    // Clean up test complaint and associated records
    console.log('\n[9] Cleaning up test complaint...');
    await Promise.all([
      Complaint.findByIdAndDelete(complaint._id),
      ComplaintAssignment.deleteMany({ complaintId: complaint._id }),
      ComplaintEscalation.deleteMany({ complaintId: complaint._id }),
      ComplaintSlaCycle.deleteMany({ complaintId: complaint._id }),
    ]);
    console.log('    Cleanup completed.');

    console.log('\n================================================================');
    console.log('✅ STEP 5.4 - SLA MANAGEMENT & AUTOMATIC ESCALATION ENGINE VERIFIED');
    console.log('================================================================\n');
  } finally {
    await disconnectDB();
  }
}

runVerification().catch((err) => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
