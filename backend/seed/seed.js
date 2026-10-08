import mongoose from 'mongoose';
import env from '../src/config/env.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import {
  User,
  Hostel,
  Block,
  Floor,
  Room,
  Department,
  SlaRule,
  EscalationRule,
} from '../src/models/index.js';
import { hashPassword } from '../src/utils/password.js';
import { ROLES } from '../src/constants/roles.js';

export const DEMO_CREDENTIALS = [
  {
    role: ROLES.SUPER_ADMIN,
    name: 'System Administrator',
    email: 'admin@bbdu.ac.in',
    password: 'Password@123',
    employeeId: 'EMP-ADM-001',
    description: 'Full platform administration & configuration',
  },
  {
    role: ROLES.AUTHORITY,
    name: 'Chief Warden Office',
    email: 'authority@bbdu.ac.in',
    password: 'Password@123',
    employeeId: 'EMP-AUTH-001',
    description: 'Campus authority overview and escalation observer',
  },
  {
    role: ROLES.WARDEN,
    name: 'Boys Hostel Warden',
    email: 'warden@bbdu.ac.in',
    password: 'Password@123',
    employeeId: 'EMP-WRD-001',
    description: 'Hostel manager for Boys Hostel 1',
  },
  {
    role: ROLES.HOSTEL_STAFF,
    name: 'Ramesh Maintenance Staff',
    email: 'staff@bbdu.ac.in',
    password: 'Password@123',
    employeeId: 'EMP-STF-001',
    description: 'Facility & maintenance supervisor',
  },
  {
    role: ROLES.STUDENT,
    name: 'Aarav Sharma',
    email: 'student@bbdu.ac.in',
    password: 'Password@123',
    studentId: 'BBDU2026-CSE-042',
    description: 'Resident student in Boys Hostel 1, Block A, Floor 1, Room 101',
  },
];

export const OFFICIAL_HOSTELS = [
  { name: 'BBDU A and B Block', code: 'BBDU-AB', type: 'BOYS', address: 'BBD University Campus, Lucknow' },
  { name: 'BBDU C and D Block', code: 'BBDU-CD', type: 'BOYS', address: 'BBD University Campus, Lucknow' },
  { name: 'Dr. Nirmala Devi Girls Hostel', code: 'NDGH', type: 'GIRLS', address: 'BBD University Campus, Lucknow' },
  { name: 'Justice D.P. Gupta Girls Hostel', code: 'DPGGH', type: 'GIRLS', address: 'BBD University Campus, Lucknow' },
  { name: 'Sheela Devi Girls Hostel', code: 'SDGH', type: 'GIRLS', address: 'BBD University Campus, Lucknow' },
  { name: 'Shail Devi Girls Hostel', code: 'SHDGH', type: 'GIRLS', address: 'BBD University Campus, Lucknow' },
  { name: 'BBDU Girls Hostel', code: 'BBDGH', type: 'GIRLS', address: 'BBD University Campus, Lucknow' },
];

export const seedDatabase = async () => {
  console.log('[seed] Starting database seed...');

  // Safely rename legacy 'BBDU Devi Girls Hostel' if present
  await Hostel.updateMany(
    { name: 'BBDU Devi Girls Hostel' },
    { $set: { name: 'BBDU Girls Hostel', code: 'BBDGH' } }
  );

  // 1. Department
  let dept = await Department.findOne({ code: 'CSE' });
  if (!dept) {
    dept = await Department.create({
      name: 'Computer Science & Engineering',
      code: 'CSE',
      description: 'Department of Computer Science & Engineering',
    });
    console.log('[seed] Created Department: CSE');
  }

  // 2. Hostel Hierarchy: Seed all 7 required Hostels, Blocks (1, 2, 3), Floors (1, 2, 3, 4, 5), and Rooms
  let firstHostel = null;
  let firstBlock = null;
  let firstFloor = null;
  let firstRoom = null;

  for (const hData of OFFICIAL_HOSTELS) {
    let hostel = await Hostel.findOne({ name: hData.name });
    if (!hostel) {
      hostel = await Hostel.findOne({ code: hData.code });
    }
    if (!hostel) {
      hostel = await Hostel.create({
        name: hData.name,
        code: hData.code,
        type: hData.type,
        address: hData.address,
        description: `${hData.name} - BBDU Residential Block`,
      });
      console.log(`[seed] Created Hostel: ${hostel.name}`);
    }

    if (!firstHostel) firstHostel = hostel;

    // Create Blocks 1, 2, 3
    for (const blockNum of ['1', '2', '3']) {
      let block = await Block.findOne({ hostelId: hostel._id, code: blockNum });
      if (!block) {
        block = await Block.create({
          hostelId: hostel._id,
          name: blockNum,
          code: blockNum,
          description: `Block ${blockNum}`,
        });
        console.log(`[seed] Created Block ${blockNum} for ${hostel.name}`);
      }

      if (firstHostel._id.equals(hostel._id) && !firstBlock) firstBlock = block;

      // Create Floors 1, 2, 3, 4, 5
      for (const floorNum of [1, 2, 3, 4, 5]) {
        let floor = await Floor.findOne({ blockId: block._id, floorNumber: floorNum });
        if (!floor) {
          floor = await Floor.create({
            hostelId: hostel._id,
            blockId: block._id,
            floorNumber: floorNum,
            name: `${floorNum}`,
          });
          console.log(`[seed] Created Floor ${floorNum} for Block ${blockNum}, ${hostel.name}`);
        }

        if (firstBlock && firstBlock._id.equals(block._id) && !firstFloor) firstFloor = floor;

        // Create Rooms: 101-105 for Floor 1, 201-205 for Floor 2, 301-305 for Floor 3
        const roomNumbers = [1, 2, 3, 4, 5].map((idx) => `${floorNum}0${idx}`);
        for (const rNum of roomNumbers) {
          let room = await Room.findOne({ floorId: floor._id, roomNumber: rNum });
          if (!room) {
            room = await Room.create({
              hostelId: hostel._id,
              blockId: block._id,
              floorId: floor._id,
              roomNumber: rNum,
              roomType: 'DOUBLE',
              capacity: 2,
              currentOccupancy: 0,
            });
          }
          if (firstFloor && firstFloor._id.equals(floor._id) && !firstRoom) firstRoom = room;
        }
      }
    }
  }

  // 3. Demo Users
  const defaultPasswordHash = await hashPassword('Password@123');

  for (const cred of DEMO_CREDENTIALS) {
    const existing = await User.findOne({ email: cred.email });
    if (!existing) {
      const userData = {
        name: cred.name,
        email: cred.email,
        passwordHash: defaultPasswordHash,
        role: cred.role,
        departmentId: dept._id,
        isActive: true,
      };

      if (cred.studentId) {
        userData.studentId = cred.studentId;
        userData.hostelId = firstHostel._id;
        userData.blockId = firstBlock._id;
        userData.floorId = firstFloor._id;
        userData.roomId = firstRoom._id;
      }

      if (cred.employeeId) {
        userData.employeeId = cred.employeeId;
        if (cred.role === ROLES.WARDEN || cred.role === ROLES.HOSTEL_STAFF) {
          userData.hostelId = firstHostel._id;
        }
      }

      await User.create(userData);
      console.log(`[seed] Created demo user: ${cred.email} (${cred.role})`);
    } else {
      console.log(`[seed] User already exists: ${cred.email}`);
    }
  }

  // 4. Default Configurable SLA Rules
  const defaultSlaRules = [
    {
      name: 'Critical Priority SLA',
      code: 'SLA-CRITICAL',
      priority: 'CRITICAL',
      description: 'Emergency safety and major infrastructure failure response',
      resolutionHours: 4,
      reminderThresholdPercent: 75,
      escalationEnabled: true,
      escalationAfterHours: 0,
    },
    {
      name: 'High Priority SLA',
      code: 'SLA-HIGH',
      priority: 'HIGH',
      description: 'High impact facility disruption (power, water, locks)',
      resolutionHours: 24,
      reminderThresholdPercent: 75,
      escalationEnabled: true,
      escalationAfterHours: 0,
    },
    {
      name: 'Medium Priority SLA',
      code: 'SLA-MEDIUM',
      priority: 'MEDIUM',
      description: 'Standard hostel maintenance and room fixtures',
      resolutionHours: 48,
      reminderThresholdPercent: 75,
      escalationEnabled: true,
      escalationAfterHours: 0,
    },
    {
      name: 'Low Priority SLA',
      code: 'SLA-LOW',
      priority: 'LOW',
      description: 'Cosmetic or minor routine upkeep',
      resolutionHours: 72,
      reminderThresholdPercent: 75,
      escalationEnabled: true,
      escalationAfterHours: 0,
    },
  ];

  for (const rule of defaultSlaRules) {
    const existing = await SlaRule.findOne({ code: rule.code });
    if (!existing) {
      await SlaRule.create(rule);
      console.log(`[seed] Created SLA rule: ${rule.code} (${rule.resolutionHours}h)`);
    }
  }

  // 5. Default Escalation Hierarchy Rules
  const defaultEscalationRules = [
    {
      name: 'Level 1: Staff to Warden Escalation',
      code: 'ESC-LVL1',
      escalationLevel: 1,
      fromRole: ROLES.HOSTEL_STAFF,
      toRole: ROLES.WARDEN,
      nextAuthorityRole: ROLES.WARDEN,
      resolutionHours: 24,
      escalationAfterHours: 0,
      isActive: true,
    },
    {
      name: 'Level 2: Warden to Authority Escalation',
      code: 'ESC-LVL2',
      escalationLevel: 2,
      fromRole: ROLES.WARDEN,
      toRole: ROLES.AUTHORITY,
      nextAuthorityRole: ROLES.AUTHORITY,
      resolutionHours: 24,
      escalationAfterHours: 0,
      isActive: true,
    },
    {
      name: 'Level 3: Authority to Super Admin Escalation',
      code: 'ESC-LVL3',
      escalationLevel: 3,
      fromRole: ROLES.AUTHORITY,
      toRole: ROLES.SUPER_ADMIN,
      nextAuthorityRole: ROLES.SUPER_ADMIN,
      resolutionHours: 24,
      escalationAfterHours: 0,
      isActive: true,
    },
  ];

  for (const esc of defaultEscalationRules) {
    const existing = await EscalationRule.findOne({ code: esc.code });
    if (!existing) {
      await EscalationRule.create(esc);
      console.log(`[seed] Created Escalation rule: ${esc.code} (Level ${esc.escalationLevel})`);
    }
  }

  // 6. Ensure all registered student accounts in local DB have valid room allocation
  const unallocatedStudents = await User.find({
    role: ROLES.STUDENT,
    $or: [{ hostelId: null }, { roomId: null }],
  });
  for (const student of unallocatedStudents) {
    student.hostelId = firstHostel._id;
    student.blockId = firstBlock._id;
    student.floorId = firstFloor._id;
    student.roomId = firstRoom._id;
    await student.save();
    console.log(`[seed] Auto-allocated student: ${student.email} -> Hostel ${firstHostel.name}, Room ${firstRoom.roomNumber}`);
  }

  console.log('[seed] Seed completed successfully.');
};

// If run directly: node seed/seed.js
if (process.argv[1]?.endsWith('seed.js')) {
  try {
    await connectDB();
    await seedDatabase();
    await disconnectDB();
    process.exit(0);
  } catch (err) {
    console.error('[seed] Error:', err.message);
    process.exit(1);
  }
}
