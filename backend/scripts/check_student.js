import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({}, { strict: false });
const User = mongoose.model('User', userSchema, 'users');

async function checkStudent() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/bbdu_hosteller');
    console.log('Connected to MongoDB bbdu_hosteller database');

    const students = await User.find({ role: 'STUDENT' }).lean();
    console.log(`Found ${students.length} student account(s):`);

    students.forEach((s, idx) => {
      console.log(`\n--- Student #${idx + 1} ---`);
      console.log('ID:', s._id);
      console.log('Name:', s.name);
      console.log('Email:', s.email);
      console.log('StudentId:', s.studentId);
      console.log('HostelId:', s.hostelId);
      console.log('BlockId:', s.blockId);
      console.log('FloorId:', s.floorId);
      console.log('RoomId:', s.roomId);
    });

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await mongoose.disconnect();
  }
}

checkStudent();
