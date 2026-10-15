import nodemailer from 'nodemailer';
import ApiError from '../utils/ApiError.js';

let cachedTransporter = null;
let lastUser = null;
let lastPass = null;

/**
 * Initialize or get cached Nodemailer transporter.
 * Supports standard Gmail App Passwords and custom SMTP.
 */
export function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT) || 465;
  const user = (process.env.EMAIL_USER || process.env.SMTP_USER || '').trim();
  const pass = (process.env.EMAIL_PASS || process.env.SMTP_PASS || '').trim().replace(/\s+/g, '');

  if (!user || !pass) {
    cachedTransporter = null;
    return null;
  }

  if (cachedTransporter && lastUser === user && lastPass === pass) {
    return cachedTransporter;
  }

  try {
    if (host) {
      cachedTransporter = nodemailer.createTransport({
        host,
        port,
        secure: process.env.SMTP_SECURE === 'true' || port === 465,
        auth: { user, pass },
        tls: { rejectUnauthorized: false },
      });
      console.log(`[EmailService] Configured custom SMTP transporter: ${host}:${port} (${user})`);
    } else {
      // Standard Gmail SMTP configuration (host: smtp.gmail.com, port: 465 SSL)
      cachedTransporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: { user, pass },
        tls: { rejectUnauthorized: false },
      });
      console.log(`[EmailService] Configured Gmail SMTP transporter for: ${user}`);
    }

    lastUser = user;
    lastPass = pass;
    return cachedTransporter;
  } catch (err) {
    console.error('[EmailService] Failed to initialize SMTP transporter:', err.message);
    cachedTransporter = null;
    return null;
  }
}

/**
 * Generate standard HTML email body for Registration OTP verification.
 */
function buildOtpEmailHtml({ name, otp, role, expiresMinutes = 5 }) {
  const roleDisplay = role === 'WARDEN' ? 'Hostel Warden' : 'Student Resident';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BBDU Hosteller - Email Verification Code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 40px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 580px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.08), 0 8px 10px -6px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%); padding: 32px 30px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: 0.5px;">
                BBDU HOSTELLER
              </h1>
              <p style="margin: 6px 0 0; font-size: 13px; color: #93c5fd; font-weight: 500;">
                Babu Banarasi Das University - Campus Hostel Portal
              </p>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 36px 32px 28px;">
              <h2 style="margin: 0 0 12px; font-size: 20px; font-weight: 700; color: #0f172a;">
                Email Verification Code
              </h2>
              <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.6; color: #475569;">
                Hello <strong>${name ? name : 'there'}</strong>,
              </p>
              <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #475569;">
                You are registering as a <strong>${roleDisplay}</strong> on the official BBDU Hosteller platform. Please use the One-Time Password (OTP) below to complete your email verification and confirm your account:
              </p>

              <!-- OTP Display Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 28px 0;">
                <tr>
                  <td align="center" style="background: linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%); border: 2px dashed #3b82f6; border-radius: 12px; padding: 24px;">
                    <div style="font-size: 12px; font-weight: 700; color: #2563eb; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 8px;">
                      Your One-Time Password (OTP)
                    </div>
                    <div style="font-size: 38px; font-weight: 800; letter-spacing: 10px; color: #1e3a8a; font-family: 'Courier New', Courier, monospace;">
                      ${otp}
                    </div>
                    <div style="font-size: 12px; color: #64748b; margin-top: 8px;">
                      Valid for ${expiresMinutes} minutes &bull; Single-use only
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Notice Box -->
              <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 6px; margin: 24px 0;">
                <p style="margin: 0; font-size: 13px; color: #92400e; line-height: 1.5;">
                  <strong>Security Note:</strong> Never share this OTP with anyone, including university wardens or IT staff. If you did not initiate this registration request, please disregard this email.
                </p>
              </div>

              <p style="margin: 24px 0 0; font-size: 14px; line-height: 1.5; color: #64748b;">
                Best regards,<br>
                <strong style="color: #334155;">BBDU Hostel Administration & IT Services</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 30px; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #94a3b8; line-height: 1.5;">
                This is an automated system email sent to your account.<br>
                Babu Banarasi Das University, Faizabad Road, Lucknow, Uttar Pradesh 226028
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

/**
 * Send registration verification OTP to user's university email or Gmail.
 *
 * @param {Object} options
 * @param {string} options.email
 * @param {string} options.otp
 * @param {string} [options.name]
 * @param {string} [options.role]
 * @returns {Promise<{ delivered: boolean, previewOtp?: string, simulated?: boolean, messageId?: string }>}
 */
export async function sendRegistrationOtpEmail({ email, otp, name = '', role = 'STUDENT' }) {
  const mailTransporter = getTransporter();
  const user = (process.env.EMAIL_USER || process.env.SMTP_USER || '').trim();
  const fromAddress = (process.env.EMAIL_FROM && user && process.env.EMAIL_FROM.includes(user))
    ? process.env.EMAIL_FROM
    : (user ? `"BBDU Hosteller" <${user}>` : '"BBDU Hosteller" <noreply@bbdu.ac.in>');
  const subject = `BBDU Hosteller - Verification OTP: ${otp} (Valid for 5 mins)`;
  const html = buildOtpEmailHtml({ name, otp, role, expiresMinutes: 5 });
  const text = `Hello ${name || 'User'},\n\nYour BBDU Hosteller verification code is: ${otp}\nRole: ${role === 'WARDEN' ? 'Hostel Warden' : 'Student Resident'}\nValid for 5 minutes.\nDo not share this OTP with anyone.\n\nBBDU Hostel Administration`;

  // Always log OTP to backend console for developer and admin convenience
  console.log('\n================================================================');
  console.log(`[BBDU HOSTELLER EMAIL SERVICE - REGISTRATION OTP]`);
  console.log(`Recipient: ${email}`);
  console.log(`Role:      ${role}`);
  console.log(`OTP Code:  ${otp}`);
  console.log(`Expires:   5 minutes`);
  console.log('================================================================\n');

  if (mailTransporter) {
    try {
      const info = await mailTransporter.sendMail({
        from: fromAddress,
        to: email,
        subject,
        text,
        html,
      });
      console.log(`[EmailService] ✅ Real OTP email dispatched to ${email}. MessageId: ${info.messageId}`);
      // When real email is sent to user's Gmail, do NOT return previewOtp so user must check their inbox!
      return {
        delivered: true,
        simulated: false,
        messageId: info.messageId,
      };
    } catch (err) {
      console.error(`\n[EmailService] ❌ Error dispatching mail via Gmail/SMTP to ${email}:`, err.message);
      let userMsg = `Failed to send email to ${email}. ${err.message}`;
      if (err.message.includes('Username and Password not accepted') || err.message.includes('BadCredentials')) {
        userMsg = 'Gmail authentication failed: Please check your Google 16-character App Password in backend/.env (not regular Gmail password).';
      }
      throw new ApiError(500, userMsg);
    }
  }

  // If no SMTP configured in backend/.env:
  console.log(`\n================================================================`);
  console.log(`[EmailService] ⚠️ GMAIL SMTP CREDENTIALS NOT CONFIGURED in backend/.env`);
  console.log(`[EmailService] To send real OTP emails directly to ${email}:`);
  console.log(`               1. Add EMAIL_USER=your_email@gmail.com in backend/.env`);
  console.log(`               2. Add EMAIL_PASS=your_16_char_app_password in backend/.env`);
  console.log(`[EmailService] >>> SIMULATED OTP FOR ${email} IS: [ ${otp} ] <<<`);
  console.log(`================================================================\n`);

  return {
    delivered: false,
    previewOtp: otp,
    simulated: true,
  };
}
