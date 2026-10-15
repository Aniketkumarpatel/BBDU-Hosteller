import env from '../src/config/env.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import Hostel from '../src/models/Hostel.js';
import Block from '../src/models/Block.js';
import Floor from '../src/models/Floor.js';
import Room from '../src/models/Room.js';

await connectDB();
console.log('Connected to MongoDB. Configuring 3 Virtual Visit Rooms...');

// 1. Hostels
let abHostel = await Hostel.findOne({ code: 'BBDU-AB' });
if (!abHostel) {
  abHostel = await Hostel.create({
    name: 'BBDU A and B Block',
    code: 'BBDU-AB',
    type: 'BOYS',
    address: 'BBD University Campus, Lucknow',
    description: 'Senior Wing Residential Hostel',
  });
}

let cdHostel = await Hostel.findOne({ code: 'BBDU-CD' });
if (!cdHostel) {
  cdHostel = await Hostel.create({
    name: 'BBDU C and D Block',
    code: 'BBDU-CD',
    type: 'BOYS',
    address: 'BBD University Campus, Lucknow',
    description: 'Junior Wing Residential Hostel',
  });
}

// 2. Blocks
// Block A (Seniors) under abHostel
let blockA = await Block.findOne({ hostelId: abHostel._id, code: 'BLOCK-A' });
if (!blockA) {
  blockA = await Block.create({
    hostelId: abHostel._id,
    name: 'Block A (Seniors)',
    code: 'BLOCK-A',
    description: 'Block A for Senior Students',
  });
}

// Block B (Seniors) under abHostel
let blockB = await Block.findOne({ hostelId: abHostel._id, code: 'BLOCK-B' });
if (!blockB) {
  blockB = await Block.create({
    hostelId: abHostel._id,
    name: 'Block B (Seniors)',
    code: 'BLOCK-B',
    description: 'Block B for Senior Students',
  });
}

// Block C (Juniors) under cdHostel
let blockC = await Block.findOne({ hostelId: cdHostel._id, code: 'BLOCK-C' });
if (!blockC) {
  blockC = await Block.create({
    hostelId: cdHostel._id,
    name: 'Block C (Juniors)',
    code: 'BLOCK-C',
    description: 'Block C for Junior Students',
  });
}

// Block D (Juniors) under cdHostel
let blockD = await Block.findOne({ hostelId: cdHostel._id, code: 'BLOCK-D' });
if (!blockD) {
  blockD = await Block.create({
    hostelId: cdHostel._id,
    name: 'Block D (Juniors)',
    code: 'BLOCK-D',
    description: 'Block D for Junior Students',
  });
}

// 3. Floors (Floors 1, 2, 3)
async function ensureFloor(hostelId, blockId, floorNum) {
  let floor = await Floor.findOne({ blockId, floorNumber: floorNum });
  if (!floor) {
    floor = await Floor.create({
      hostelId,
      blockId,
      floorNumber: floorNum,
      name: `Floor ${floorNum}`,
    });
  }
  return floor;
}

const floor1_A = await ensureFloor(abHostel._id, blockA._id, 1);
const floor2_B = await ensureFloor(abHostel._id, blockB._id, 2);
const floor3_C = await ensureFloor(cdHostel._id, blockC._id, 3);
await ensureFloor(cdHostel._id, blockD._id, 1);
await ensureFloor(cdHostel._id, blockD._id, 2);
await ensureFloor(cdHostel._id, blockD._id, 3);

// 4. Ensure Exactly 3 Virtual Visit Rooms
// Clear previous virtual visit room flags if any
await Room.updateMany({}, { $set: { isVirtualVisitRoom: false } });

// Room 1: Single Sharing (AC) in Block A (Seniors), Floor 1
let room1 = await Room.findOne({ floorId: floor1_A._id, roomNumber: '101' });
if (!room1) {
  room1 = await Room.create({
    hostelId: abHostel._id,
    blockId: blockA._id,
    floorId: floor1_A._id,
    roomNumber: '101',
    roomType: 'SINGLE',
    isAc: true,
    capacity: 1,
    currentOccupancy: 0,
    facilities: ['Available Bed', 'Chair', 'Table', 'Almirah', 'AC', 'High-Speed Wi-Fi', 'Geyser', 'Power Backup'],
    description: 'Deluxe Single Sharing Room (AC) with ergonomic study chair, study table, and steel almirah.',
    isVirtualVisitRoom: true,
  });
} else {
  room1.isVirtualVisitRoom = true;
  room1.isAc = true;
  room1.roomType = 'SINGLE';
  room1.capacity = 1;
  room1.currentOccupancy = 0;
  room1.facilities = ['Available Bed', 'Chair', 'Table', 'Almirah', 'AC', 'High-Speed Wi-Fi', 'Geyser', 'Power Backup'];
  await room1.save();
}

// Room 2: Double Sharing (Non-AC) in Block B (Seniors), Floor 2
let room2 = await Room.findOne({ floorId: floor2_B._id, roomNumber: '202' });
if (!room2) {
  room2 = await Room.create({
    hostelId: abHostel._id,
    blockId: blockB._id,
    floorId: floor2_B._id,
    roomNumber: '202',
    roomType: 'DOUBLE',
    isAc: false,
    capacity: 2,
    currentOccupancy: 1,
    facilities: ['Available Bed', 'Chair', 'Table', 'Almirah', 'Non-AC', 'High-Speed Wi-Fi', 'Geyser', 'Power Backup'],
    description: 'Premium Double Sharing Room (Non-AC) with individual study tables, chairs, almirahs, and ceiling fan.',
    isVirtualVisitRoom: true,
  });
} else {
  room2.isVirtualVisitRoom = true;
  room2.isAc = false;
  room2.roomType = 'DOUBLE';
  room2.capacity = 2;
  room2.currentOccupancy = 1;
  room2.facilities = ['Available Bed', 'Chair', 'Table', 'Almirah', 'Non-AC', 'High-Speed Wi-Fi', 'Geyser', 'Power Backup'];
  await room2.save();
}

// Room 3: Triple Sharing (AC) in Block C (Juniors), Floor 3
let room3 = await Room.findOne({ floorId: floor3_C._id, roomNumber: '303' });
if (!room3) {
  room3 = await Room.create({
    hostelId: cdHostel._id,
    blockId: blockC._id,
    floorId: floor3_C._id,
    roomNumber: '303',
    roomType: 'TRIPLE',
    isAc: true,
    capacity: 3,
    currentOccupancy: 1,
    facilities: ['Available Bed', 'Chair', 'Table', 'Almirah', 'AC', 'High-Speed Wi-Fi', 'Geyser', 'Power Backup'],
    description: 'Spacious Junior Wing Triple Sharing Room (AC) with 3 study tables, 3 chairs, 3 almirahs, and 24x7 security.',
    isVirtualVisitRoom: true,
  });
} else {
  room3.isVirtualVisitRoom = true;
  room3.isAc = true;
  room3.roomType = 'TRIPLE';
  room3.capacity = 3;
  room3.currentOccupancy = 1;
  room3.facilities = ['Available Bed', 'Chair', 'Table', 'Almirah', 'AC', 'High-Speed Wi-Fi', 'Geyser', 'Power Backup'];
  await room3.save();
}

const vvRooms = await Room.find({ isVirtualVisitRoom: true })
  .populate('hostelId', 'name')
  .populate('blockId', 'name')
  .populate('floorId', 'floorNumber name');

console.log(`✓ Configured exactly ${vvRooms.length} Virtual Visit Rooms:`);
vvRooms.forEach((r) => {
  console.log(`- Room ${r.roomNumber}: ${r.roomType} (${r.isAc ? 'AC' : 'Non-AC'}), Hostel: ${r.hostelId?.name}, Block: ${r.blockId?.name}, Floor: ${r.floorId?.name}, Facilities: ${r.facilities?.join(', ')}`);
});

await disconnectDB();
console.log('Done!');
