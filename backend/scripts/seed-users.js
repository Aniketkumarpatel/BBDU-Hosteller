import { connectDB, disconnectDB } from '../src/config/db.js';
import { User, Hostel, Department } from '../src/models/index.js';
import { hashPassword } from '../src/utils/password.js';
import { ROLES } from '../src/constants/roles.js';

async function seedAllUsers() {
  console.log('[seed-users] Connecting to DB...');
  await connectDB();

  console.log('[seed-users] Preparing demo accounts...');
  const defaultPasswordHash = await hashPassword('Password@123');

  // 1. Ensure primary hostel
  let hostel = await Hostel.findOne({ code: 'BBDU-AB' });
  if (!hostel) {
    hostel = await Hostel.findOne();
  }
  if (!hostel) {
    hostel = await Hostel.create({
      name: 'BBDU A and B Block',
      code: 'BBDU-AB',
      type: 'BOYS',
      address: 'BBD University Campus, Lucknow',
      description: 'Pilot Residential Hostel for Boys',
    });
  }

  // 2. Ensure primary dept
  let dept = await Department.findOne({ code: 'CSE' });
  if (!dept) {
    dept = await Department.create({
      code: 'CSE',
      name: 'Computer Science & Engineering',
      description: 'Department of Computer Science & Engineering',
    });
  }

  const USERS_TO_SEED = [
    {
      role: ROLES.SUPER_ADMIN,
      name: 'System Administrator',
      email: 'admin@bbdu.ac.in',
      employeeId: 'EMP-ADM-001',
    },
    {
      role: ROLES.AUTHORITY,
      name: 'Chief Warden Office',
      email: 'authority@bbdu.ac.in',
      employeeId: 'EMP-AUTH-001',
    },
    {
      role: ROLES.WARDEN,
      name: 'Boys Hostel Warden',
      email: 'warden@bbdu.ac.in',
      employeeId: 'EMP-WRD-001',
      hostelId: hostel._id,
    },
    {
      role: ROLES.HOSTEL_STAFF,
      name: 'Ramesh Maintenance Staff',
      email: 'staff@bbdu.ac.in',
      employeeId: 'EMP-STF-001',
      hostelId: hostel._id,
    },
    {
      role: ROLES.HOSTEL_STAFF,
      name: 'Suresh Electrician',
      email: 'electrician@bbdu.ac.in',
      employeeId: 'EMP-STF-002',
      hostelId: hostel._id,
    },
    {
      role: ROLES.STUDENT,
      name: 'Aarav Sharma',
      email: 'student@bbdu.ac.in',
      studentId: 'BBDU2026-CSE-042',
      hostelId: hostel._id,
    },
    {
      role: ROLES.STUDENT,
      name: 'Rohan Gupta',
      email: 'rohan@bbdu.ac.in',
      studentId: 'BBDU2026-CSE-088',
      hostelId: hostel._id,
    },
    {
      role: ROLES.STUDENT,
      name: 'Kabir Das',
      email: 'kabir@bbdu.ac.in',
      studentId: 'BBDU2026-CSE-105',
      hostelId: hostel._id,
    },
  ];

  for (const u of USERS_TO_SEED) {
    let existing = await User.findOne({ email: u.email });
    if (!existing) {
      await User.create({
        ...u,
        passwordHash: defaultPasswordHash,
        departmentId: dept._id,
        isActive: true,
      });
      console.log(`✓ Created user: ${u.email} (${u.role})`);
    } else {
      existing.passwordHash = defaultPasswordHash;
      existing.role = u.role;
      existing.isActive = true;
      if (u.hostelId && !existing.hostelId) existing.hostelId = u.hostelId;
      if (u.employeeId) existing.employeeId = u.employeeId;
      if (u.studentId) existing.studentId = u.studentId;
      await existing.save();
      console.log(`✓ Updated user password: ${u.email} (${u.role})`);
    }
  }

  console.log('\n[seed-users] All demo users successfully seeded with password: Password@123');
  await disconnectDB();
}

seedAllUsers().catch((err) => {
  console.error('[seed-users] Error:', err);
  process.exit(1);
});
