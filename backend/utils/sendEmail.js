

/**
 * Shared HTML shell for all outgoing emails. Dark theme to match the app.
 */
function emailShell({ title, heading, bodyHtml }) {
  return `
  <!DOCTYPE html>
  <html>
  <head><meta charset="UTF-8" /><title>${title}</title></head>
  <body style="margin:0;padding:0;background-color:#0b0f19;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0b0f19;padding:40px 0;">
      <tr>
        <td align="center">
          <table width="480" cellpadding="0" cellspacing="0" style="background:linear-gradient(145deg,#111827,#0b0f19);border:1px solid #1f2937;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:28px 32px;border-bottom:1px solid #1f2937;">
                <span style="color:#3b82f6;font-size:22px;font-weight:700;letter-spacing:0.5px;">🔐 SecureCrypt</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <h2 style="color:#ffffff;margin:0 0 16px;font-size:20px;">${heading}</h2>
                <div style="color:#9ca3af;font-size:15px;line-height:1.6;">${bodyHtml}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;border-top:1px solid #1f2937;">
                <span style="color:#4b5563;font-size:12px;">This is an automated message from SecureCrypt. If you did not request this, you can safely ignore this email.</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>`;
}

function otpBlockHtml(otp, minutes) {
  return `
    <div style="margin:24px 0;text-align:center;">
      <span style="display:inline-block;background:#1f2937;color:#60a5fa;font-size:32px;font-weight:700;letter-spacing:8px;padding:16px 24px;border-radius:10px;">${otp}</span>
    </div>
    <p style="color:#9ca3af;font-size:14px;">This code expires in <strong style="color:#e5e7eb;">${minutes} minutes</strong>.</p>
  `;
}

async function sendMail({ to, subject, html }) {
     const response = await fetch('https://api.resend.com/emails', {
       method: 'POST',
       headers: {
         Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
         'Content-Type': 'application/json',
       },
       body: JSON.stringify({
         from: process.env.EMAIL_FROM,
         to,
         subject,
         html,
       }),
     });

     if (!response.ok) {
       const errorBody = await response.text().catch(() => '');
       throw new Error(`Failed to send email (${response.status}): ${errorBody}`);
     }
   }

async function sendWelcomeEmail(to, name) {
  const html = emailShell({
    title: 'Welcome to SecureCrypt',
    heading: `Welcome, ${name} 👋`,
    bodyHtml: `<p>Your SecureCrypt account has been created. Please verify your email to activate all features.</p>`,
  });
  await sendMail({ to, subject: 'Welcome to SecureCrypt', html });
}

async function sendVerificationOTP(to, name, otp) {
  const minutes = process.env.OTP_EXPIRES_MINUTES || 10;
  const html = emailShell({
    title: 'Verify your email',
    heading: `Hi ${name}, verify your email`,
    bodyHtml: `<p>Use the code below to verify your SecureCrypt account.</p>${otpBlockHtml(otp, minutes)}`,
  });
  await sendMail({ to, subject: 'Verify your SecureCrypt account', html });
}

async function sendForgotPasswordOTP(to, name, otp) {
  const minutes = process.env.OTP_EXPIRES_MINUTES || 10;
  const html = emailShell({
    title: 'Reset your password',
    heading: `Hi ${name}, reset your password`,
    bodyHtml: `<p>We received a request to reset your password. Use the code below to continue.</p>${otpBlockHtml(otp, minutes)}`,
  });
  await sendMail({ to, subject: 'SecureCrypt password reset code', html });
}

async function sendDecryptOTP(to, name, otp, fileName) {
  const minutes = process.env.OTP_EXPIRES_MINUTES || 10;
  const html = emailShell({
    title: 'Decrypt authorization code',
    heading: `Hi ${name}, confirm file decryption`,
    bodyHtml: `<p>A request was made to decrypt <strong style="color:#e5e7eb;">${fileName}</strong>. Use the code below to authorize this action.</p>${otpBlockHtml(otp, minutes)}<p style="color:#f87171;font-size:13px;">If you did not request this, please secure your account immediately.</p>`,
  });
  await sendMail({ to, subject: 'SecureCrypt decrypt authorization code', html });
}

module.exports = {
  sendWelcomeEmail,
  sendVerificationOTP,
  sendForgotPasswordOTP,
  sendDecryptOTP,
};
