import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const user = (process.env.EMAIL_USER || process.env.SMTP_USER || '').trim();
const pass = (process.env.EMAIL_PASS || process.env.SMTP_PASS || '').trim().replace(/\s+/g, '');
const testRecipient = process.argv[2] || user || 'test@example.com';

console.log('====================================================');
console.log('       BBDU HOSTELLER - GMAIL SMTP TEST SCRIPT       ');
console.log('====================================================');
console.log('EMAIL_USER:', user || '(NOT SET)');
console.log('EMAIL_PASS:', pass ? `(SET - ${pass.length} chars)` : '(NOT SET)');
console.log('Target Recipient:', testRecipient);
console.log('----------------------------------------------------');

if (!user || !pass) {
  console.error('\n❌ ERROR: EMAIL_USER or EMAIL_PASS is missing in backend/.env!');
  console.log('\nTo configure real Gmail SMTP:');
  console.log('1. Go to your Google Account -> Security');
  console.log('2. Turn ON "2-Step Verification"');
  console.log('3. Go to https://myaccount.google.com/apppasswords');
  console.log('4. Create an App password (name it "Hosteller")');
  console.log('5. Paste your Gmail and the 16-character code in backend/.env:');
  console.log('   EMAIL_USER=your_email@gmail.com');
  console.log('   EMAIL_PASS=your_16_digit_app_password\n');
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user, pass },
});

console.log('\n[1/2] Verifying SMTP connection with Gmail...');
try {
  await transporter.verify();
  console.log('✅ SMTP Connection verified successfully! Gmail credentials are VALID.');
} catch (err) {
  console.error('❌ SMTP Verification failed:', err.message);
  if (err.message.includes('Username and Password not accepted') || err.message.includes('BadCredentials')) {
    console.error('\nTIP: Google requires a 16-digit App Password, not your regular Gmail account password.');
    console.error('Create one here: https://myaccount.google.com/apppasswords');
  }
  process.exit(1);
}

console.log(`\n[2/2] Sending test OTP email to: ${testRecipient}...`);
try {
  const testOtp = Math.floor(100000 + Math.random() * 900000).toString();
  const info = await transporter.sendMail({
    from: `"BBDU Hosteller" <${user}>`,
    to: testRecipient,
    subject: `BBDU Hosteller - Test Verification OTP: ${testOtp}`,
    text: `Hello!\n\nThis is a test email from BBDU Hosteller.\nYour test OTP is: ${testOtp}\nValid for 5 minutes.`,
    html: `<div style="font-family:sans-serif;padding:20px;border:1px solid #e2e8f0;border-radius:12px;max-width:500px;">
      <h2 style="color:#1e3a8a;">BBDU HOSTELLER</h2>
      <p>This is a test verification email. Your test OTP is:</p>
      <div style="font-size:32px;font-weight:bold;letter-spacing:6px;color:#2563eb;padding:12px;background:#f0f7ff;border-radius:8px;text-align:center;">
        ${testOtp}
      </div>
      <p style="color:#64748b;font-size:12px;margin-top:16px;">Valid for 5 minutes.</p>
    </div>`,
  });

  console.log(`✅ Email sent successfully! Message ID: ${info.messageId}`);
  console.log(`\n🎉 OTP Email was delivered to ${testRecipient}!`);
} catch (err) {
  console.error('❌ Failed to send email:', err.message);
  process.exit(1);
}
