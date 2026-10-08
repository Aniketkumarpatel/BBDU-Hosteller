import mongoose from 'mongoose';
import { User, Hostel, Block, Floor, Room } from '../src/models/index.js';

async function allocateUnallocatedStudents() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/bbdu_hosteller');
    console.log('[allocate] Connected to MongoDB database');

    let hostel = await Hostel.findOne({ code: 'BH1' });
    let block = await Block.findOne({ hostelId: hostel?._id, code: 'A' });
    let floor = await Floor.findOne({ blockId: block?._id, floorNumber: 1 });
    let room = await Room.findOne({ floorId: floor?._id, roomNumber: '101' });

    if (!hostel || !block || !floor || !room) {
      console.error('[allocate] Essential hostel hierarchy missing! Please run seed first.');
      return;
    }

    const unallocated = await User.find({
      role: 'STUDENT',
      $or: [
        { hostelId: { $exists: false } },
        { hostelId: null },
        { roomId: { $exists: false } },
        { roomId: null },
      ],
    });

    console.log(`[allocate] Found ${unallocated.length} unallocated student(s). Assigning to BH1 Block A Floor 1 Room 101...`);

    for (const student of unallocated) {
      student.hostelId = hostel._id;
      student.blockId = block._id;
      student.floorId = floor._id;
      student.roomId = room._id;
      await student.save();
      console.log(`[allocate] Allocated student: ${student.email} (${student.name}) -> Hostel BH1, Room 101`);
    }

    console.log('[allocate] Allocation completed successfully.');

  } catch (err) {
    console.error('[allocate] Error:', err.message);
  } finally {
    await mongoose.disconnect();
  }
}

allocateUnallocatedStudents();
