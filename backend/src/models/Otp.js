import mongoose from 'mongoose';

const otpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    trim: true,
    index: true,
  },
  otp: {
    type: String,
    required: [true, 'OTP code is required'],
  },
  role: {
    type: String,
    enum: ['STUDENT', 'WARDEN'],
    default: 'STUDENT',
  },
  purpose: {
    type: String,
    enum: ['REGISTRATION', 'PASSWORD_RESET'],
    default: 'REGISTRATION',
  },
  verified: {
    type: Boolean,
    default: false,
  },
  attempts: {
    type: Number,
    default: 0,
  },
  expiresAt: {
    type: Date,
    required: true,
    default: () => new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 300, // MongoDB TTL index: automatically deletes document after 5 minutes (300 seconds)
  },
});

otpSchema.index({ email: 1, purpose: 1 });

const Otp = mongoose.models.Otp || mongoose.model('Otp', otpSchema);
export default Otp;
