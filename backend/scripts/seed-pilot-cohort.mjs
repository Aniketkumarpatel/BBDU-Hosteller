import dotenv from 'dotenv';
dotenv.config({ quiet: true });

import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../src/config/db.js';
import {
  User,
  Hostel,
  Block,
  Floor,
  Room,
  Department,
  Complaint,
  ComplaintAssignment,
  ComplaintResolution,
  Counter,
} from '../src/models/index.js';
import { hashPassword } from '../src/utils/password.js';
import { ROLES } from '../src/constants/roles.js';
import { COMPLAINT_STATUSES } from '../src/constants/complaint.constants.js';

const MAINTENANCE_DEPARTMENTS = [
  { code: 'CSE', name: 'Computer Science & Engineering', description: 'Department of Computer Science & Engineering' },
  { code: 'PLUMB', name: 'Plumbing & Sanitation', description: 'Water fixtures, leakage, pipe repairs, and sanitary fittings' },
  { code: 'ELEC', name: 'Electrical & Power', description: 'Wiring, fixtures, switches, lighting, and power backup' },
  { code: 'HOUSEKEEPING', name: 'Housekeeping & Sanitation', description: 'Corridor cleaning, washroom hygiene, and waste collection' },
  { code: 'IT_NETWORK', name: 'IT & Network Infrastructure', description: 'Wi-Fi connectivity, LAN drops, and digital infrastructure' },
  { code: 'WATER_MAINT', name: 'Water Supply Maintenance', description: 'Overhead tanks, borewell motors, and drinking water coolers' },
  { code: 'MESS_SERVICES', name: 'Mess & Dining Services', description: 'Hostel mess operations, catering, and dining hall maintenance' },
  { code: 'CIVIL_CARPENTRY', name: 'Carpentry & Civil Maintenance', description: 'Doors, windows, furniture, locks, and masonry fixtures' },
];

async function seedPilotCohort() {
  console.log('================================================================');
  console.log('   SEEDING PHASE 1 PILOT COHORT: BOYS HOSTEL 1 (COMPLAINTS)');
  console.log('================================================================\n');

  await connectDB();

  // 1. Ensure Maintenance Departments
  console.log('1. Setting up maintenance departments...');
  const deptMap = {};
  for (const d of MAINTENANCE_DEPARTMENTS) {
    let doc = await Department.findOne({ code: d.code });
    if (!doc) {
      doc = await Department.create(d);
      console.log(`✓ Created Department: ${d.name} (${d.code})`);
    } else {
      deptMap[d.code] = doc;
    }
    deptMap[d.code] = doc;
  }

  // 2. Locate or Seed Pilot Hostel Hierarchy (BBDU A and B Block, Block 1, Floor 1)
  console.log('\n2. Setting up Pilot Hostel hierarchy...');
  let hostel = await Hostel.findOne({ code: 'BBDU-AB' });
  if (!hostel) {
    hostel = await Hostel.create({
      name: 'BBDU A and B Block',
      code: 'BBDU-AB',
      type: 'BOYS',
      address: 'BBD University Campus, Lucknow',
      description: 'Pilot Residential Hostel for Boys',
    });
    console.log('✓ Created Pilot Hostel: BBDU A and B Block');
  }

  let block = await Block.findOne({ hostelId: hostel._id, code: '1' });
  if (!block) {
    block = await Block.create({
      hostelId: hostel._id,
      name: '1',
      code: '1',
      description: 'Block 1 (Pilot Focus)',
    });
    console.log('✓ Created Pilot Block: 1');
  }

  let floor = await Floor.findOne({ blockId: block._id, floorNumber: 1 });
  if (!floor) {
    floor = await Floor.create({
      hostelId: hostel._id,
      blockId: block._id,
      floorNumber: 1,
      name: '1',
    });
    console.log('✓ Created Pilot Floor: 1');
  }

  const roomMap = {};
  for (const rNum of ['101', '102', '103', '104', '105']) {
    let room = await Room.findOne({ floorId: floor._id, roomNumber: rNum });
    if (!room) {
      room = await Room.create({
        hostelId: hostel._id,
        blockId: block._id,
        floorId: floor._id,
        roomNumber: rNum,
        roomType: 'DOUBLE',
        capacity: 2,
        currentOccupancy: 1,
      });
      console.log(`✓ Created Pilot Room: ${rNum}`);
    }
    roomMap[rNum] = room;
  }

  const defaultPasswordHash = await hashPassword('Password@123');

  // 3. Pilot Warden
  console.log('\n3. Setting up Pilot Warden...');
  let warden = await User.findOne({ email: 'warden@bbdu.ac.in' });
  if (!warden) {
    warden = await User.create({
      name: 'Boys Hostel Warden',
      email: 'warden@bbdu.ac.in',
      passwordHash: defaultPasswordHash,
      role: ROLES.WARDEN,
      employeeId: 'EMP-WRD-001',
      hostelId: hostel._id,
      isActive: true,
    });
    console.log('✓ Created Pilot Warden: warden@bbdu.ac.in');
  } else {
    warden.hostelId = hostel._id;
    warden.isActive = true;
    await warden.save();
    console.log('✓ Updated Pilot Warden: warden@bbdu.ac.in');
  }

  // 4. Pilot Maintenance Technicians
  console.log('\n4. Setting up Pilot Technicians...');
  let staffPlumber = await User.findOne({ email: 'staff@bbdu.ac.in' });
  if (!staffPlumber) {
    staffPlumber = await User.create({
      name: 'Ramesh Maintenance Staff',
      email: 'staff@bbdu.ac.in',
      passwordHash: defaultPasswordHash,
      role: ROLES.HOSTEL_STAFF,
      employeeId: 'EMP-STF-001',
      hostelId: hostel._id,
      departmentId: deptMap.PLUMB._id,
      isActive: true,
    });
    console.log('✓ Created Technician (Plumbing): staff@bbdu.ac.in');
  } else {
    staffPlumber.hostelId = hostel._id;
    staffPlumber.departmentId = deptMap.PLUMB._id;
    staffPlumber.isActive = true;
    await staffPlumber.save();
    console.log('✓ Updated Technician (Plumbing): staff@bbdu.ac.in');
  }

  let staffElectrician = await User.findOne({ email: 'electrician@bbdu.ac.in' });
  if (!staffElectrician) {
    staffElectrician = await User.create({
      name: 'Suresh Electrician',
      email: 'electrician@bbdu.ac.in',
      passwordHash: defaultPasswordHash,
      role: ROLES.HOSTEL_STAFF,
      employeeId: 'EMP-STF-002',
      hostelId: hostel._id,
      departmentId: deptMap.ELEC._id,
      isActive: true,
    });
    console.log('✓ Created Technician (Electrical): electrician@bbdu.ac.in');
  } else {
    staffElectrician.hostelId = hostel._id;
    staffElectrician.departmentId = deptMap.ELEC._id;
    staffElectrician.isActive = true;
    await staffElectrician.save();
    console.log('✓ Updated Technician (Electrical): electrician@bbdu.ac.in');
  }

  // 5. Pilot Resident Students
  console.log('\n5. Setting up Pilot Resident Students...');
  const studentConfigs = [
    {
      name: 'Aarav Sharma',
      email: 'student@bbdu.ac.in',
      studentId: 'BBDU2026-CSE-042',
      roomNumber: '101',
    },
    {
      name: 'Rohan Gupta',
      email: 'rohan@bbdu.ac.in',
      studentId: 'BBDU2026-CSE-088',
      roomNumber: '102',
    },
    {
      name: 'Kabir Das',
      email: 'kabir@bbdu.ac.in',
      studentId: 'BBDU2026-CSE-105',
      roomNumber: '103',
    },
  ];

  const students = {};
  for (const s of studentConfigs) {
    let student = await User.findOne({ email: s.email });
    const sRoom = roomMap[s.roomNumber];
    if (!student) {
      student = await User.create({
        name: s.name,
        email: s.email,
        passwordHash: defaultPasswordHash,
        role: ROLES.STUDENT,
        studentId: s.studentId,
        hostelId: hostel._id,
        blockId: block._id,
        floorId: floor._id,
        roomId: sRoom._id,
        roomNumber: s.roomNumber,
        departmentId: deptMap.CSE._id,
        isActive: true,
      });
      console.log(`✓ Created Student: ${s.email} (${s.name}, Room ${s.roomNumber})`);
    } else {
      student.hostelId = hostel._id;
      student.blockId = block._id;
      student.floorId = floor._id;
      student.roomId = sRoom._id;
      student.roomNumber = s.roomNumber;
      student.isActive = true;
      await student.save();
      console.log(`✓ Updated Student: ${s.email} (${s.name}, Room ${s.roomNumber})`);
    }
    students[s.email] = student;
  }

  // 6. Seed Realistic Pilot Complaints Across Lifecycle Stages
  console.log('\n6. Seeding baseline pilot complaints across lifecycle states...');

  const pilotComplaints = [
    {
      complaintId: 'CMP-PILOT-001',
      title: 'Water tap leaking continuously in washroom',
      description: 'The cold water wash basin tap in room 102 cannot be turned off fully and is dripping constantly.',
      category: 'PLUMBING',
      issueType: 'WATER_LEAKAGE',
      priority: 'HIGH',
      locationDescription: 'Room 102 bathroom wash basin',
      studentId: students['rohan@bbdu.ac.in']._id,
      hostelId: hostel._id,
      blockId: block._id,
      floorId: floor._id,
      roomId: roomMap['102']._id,
      departmentId: deptMap.PLUMB._id,
      status: COMPLAINT_STATUSES.SUBMITTED,
      submittedAt: new Date(Date.now() - 2 * 3600 * 1000),
    },
    {
      complaintId: 'CMP-PILOT-002',
      title: 'Ceiling tube light starter flickering',
      description: 'Tube light above study table in room 103 blinks intermittently and produces buzzing sound.',
      category: 'ELECTRICAL',
      issueType: 'LIGHT_NOT_WORKING',
      priority: 'MEDIUM',
      locationDescription: 'Room 103 main study desk ceiling',
      studentId: students['kabir@bbdu.ac.in']._id,
      hostelId: hostel._id,
      blockId: block._id,
      floorId: floor._id,
      roomId: roomMap['103']._id,
      departmentId: deptMap.ELEC._id,
      status: COMPLAINT_STATUSES.ASSIGNED,
      triagedBy: warden._id,
      triagedAt: new Date(Date.now() - 4 * 3600 * 1000),
      triageNote: 'Verified electrical flickering complaint in Block 1',
      assignedTo: staffElectrician._id,
      assignedAt: new Date(Date.now() - 3 * 3600 * 1000),
      submittedAt: new Date(Date.now() - 5 * 3600 * 1000),
    },
    {
      complaintId: 'CMP-PILOT-003',
      title: 'Bathroom floor drain slow discharge',
      description: 'Drainage pipe beneath the floor drain has accumulated sediment causing water pooling during showers in room 101.',
      category: 'PLUMBING',
      issueType: 'DRAIN_BLOCKAGE',
      priority: 'HIGH',
      locationDescription: 'Room 101 shower stall drain',
      studentId: students['student@bbdu.ac.in']._id,
      hostelId: hostel._id,
      blockId: block._id,
      floorId: floor._id,
      roomId: roomMap['101']._id,
      departmentId: deptMap.PLUMB._id,
      status: COMPLAINT_STATUSES.IN_PROGRESS,
      triagedBy: warden._id,
      triagedAt: new Date(Date.now() - 6 * 3600 * 1000),
      triageNote: 'Plumbing obstruction requiring technician snake tool',
      assignedTo: staffPlumber._id,
      assignedAt: new Date(Date.now() - 5 * 3600 * 1000),
      acknowledgedBy: staffPlumber._id,
      acknowledgedAt: new Date(Date.now() - 4 * 3600 * 1000),
      startedAt: new Date(Date.now() - 2 * 3600 * 1000),
      submittedAt: new Date(Date.now() - 7 * 3600 * 1000),
    },
    {
      complaintId: 'CMP-PILOT-004',
      title: 'Loose electrical socket for laptop desk',
      description: 'Switch board socket on wall near study desk in room 101 was loose and sparking when plugging in laptop charger.',
      category: 'ELECTRICAL',
      issueType: 'SWITCH_SOCKET_ISSUE',
      priority: 'MEDIUM',
      locationDescription: 'Room 101 wall socket next to bed 1',
      studentId: students['student@bbdu.ac.in']._id,
      hostelId: hostel._id,
      blockId: block._id,
      floorId: floor._id,
      roomId: roomMap['101']._id,
      departmentId: deptMap.ELEC._id,
      status: COMPLAINT_STATUSES.STUDENT_VERIFICATION,
      triagedBy: warden._id,
      triagedAt: new Date(Date.now() - 8 * 3600 * 1000),
      triageNote: 'Electrical socket replacement needed',
      assignedTo: staffElectrician._id,
      assignedAt: new Date(Date.now() - 7 * 3600 * 1000),
      acknowledgedBy: staffElectrician._id,
      acknowledgedAt: new Date(Date.now() - 6 * 3600 * 1000),
      startedAt: new Date(Date.now() - 5 * 3600 * 1000),
      resolvedBy: staffElectrician._id,
      resolvedAt: new Date(Date.now() - 1 * 3600 * 1000),
      resolutionNote: 'Replaced modular 6A switch socket and tightened back box mounting screws.',
      submittedAt: new Date(Date.now() - 9 * 3600 * 1000),
    },
    {
      complaintId: 'CMP-PILOT-005',
      title: 'Geyser braided inlet valve dripping',
      description: 'Braided connection pipe connected to 25L storage geyser in room 101 had pinhole leak.',
      category: 'PLUMBING',
      issueType: 'WATER_LEAKAGE',
      priority: 'HIGH',
      locationDescription: 'Room 101 geyser inlet valve',
      studentId: students['student@bbdu.ac.in']._id,
      hostelId: hostel._id,
      blockId: block._id,
      floorId: floor._id,
      roomId: roomMap['101']._id,
      departmentId: deptMap.PLUMB._id,
      status: COMPLAINT_STATUSES.CLOSED,
      triagedBy: warden._id,
      triagedAt: new Date(Date.now() - 24 * 3600 * 1000),
      triageNote: 'Urgent hot water line leakage',
      assignedTo: staffPlumber._id,
      assignedAt: new Date(Date.now() - 23 * 3600 * 1000),
      acknowledgedBy: staffPlumber._id,
      acknowledgedAt: new Date(Date.now() - 22 * 3600 * 1000),
      startedAt: new Date(Date.now() - 20 * 3600 * 1000),
      resolvedBy: staffPlumber._id,
      resolvedAt: new Date(Date.now() - 18 * 3600 * 1000),
      resolutionNote: 'Replaced 18-inch braided flexible pipe and tested under full supply pressure.',
      verifiedBy: students['student@bbdu.ac.in']._id,
      verifiedAt: new Date(Date.now() - 16 * 3600 * 1000),
      verificationNote: 'Checked geyser valve, completely dry. Great work.',
      closedAt: new Date(Date.now() - 16 * 3600 * 1000),
      submittedAt: new Date(Date.now() - 25 * 3600 * 1000),
    },
  ];

  for (const cData of pilotComplaints) {
    let existing = await Complaint.findOne({ complaintId: cData.complaintId });
    if (!existing) {
      existing = await Complaint.create(cData);
      console.log(`✓ Seeded complaint: ${cData.complaintId} (${cData.status}) - ${cData.title}`);

      // Seed assignment history
      if (cData.assignedTo) {
        await ComplaintAssignment.create({
          complaintId: existing._id,
          assignedBy: warden._id,
          assignedTo: cData.assignedTo,
          departmentId: cData.departmentId,
          assignmentType: 'MANUAL',
          reason: 'Pilot maintenance assignment',
          assignedAt: cData.assignedAt,
          acknowledgedAt: cData.acknowledgedAt || null,
          isCurrent: true,
        });
      }

      // Seed resolution history
      if (cData.resolvedBy) {
        await ComplaintResolution.create({
          complaintId: existing._id,
          attemptNumber: 1,
          resolvedBy: cData.resolvedBy,
          resolutionNote: cData.resolutionNote,
          resolvedAt: cData.resolvedAt,
          verificationDecision: cData.status === COMPLAINT_STATUSES.CLOSED ? 'ACCEPT' : null,
          verifiedBy: cData.verifiedBy || null,
          verifiedAt: cData.verifiedAt || null,
          verificationNote: cData.verificationNote || '',
        });
      }
    } else {
      console.log(`✓ Existing complaint preserved: ${cData.complaintId} (${existing.status})`);
    }
  }

  await disconnectDB();

  console.log('\n================================================================');
  console.log('   PILOT COHORT SEEDING COMPLETED SUCCESSFULLY!');
  console.log('================================================================');
  console.log('\nPILOT CREDENTIALS (All use password: Password@123):');
  console.log('  Role: WARDEN');
  console.log('    Email: warden@bbdu.ac.in (Boys Hostel Warden - BBDU A and B Block)');
  console.log('  Role: HOSTEL_STAFF (Technicians)');
  console.log('    Email: staff@bbdu.ac.in (Ramesh - Plumbing & Sanitation)');
  console.log('    Email: electrician@bbdu.ac.in (Suresh - Electrical & Power)');
  console.log('  Role: STUDENT (Residents in Block 1)');
  console.log('    Email: student@bbdu.ac.in (Aarav Sharma - Room 101)');
  console.log('    Email: rohan@bbdu.ac.in (Rohan Gupta - Room 102)');
  console.log('    Email: kabir@bbdu.ac.in (Kabir Das - Room 103)\n');
}

seedPilotCohort().catch((err) => {
  console.error('\n❌ PILOT SEED FAILED:', err.message);
  process.exit(1);
});
