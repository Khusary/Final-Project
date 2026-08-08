const nodemailer = require('nodemailer');

/**
 * Single shared transporter instance built from env vars.
 * Works with Gmail (app password) or any standard SMTP provider.
 */
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Verify connection configuration at boot (non-fatal if it fails)
transporter.verify((error) => {
  if (error) {
    console.warn('[Mailer] SMTP connection could not be verified:', error.message);
  } else {
    console.log('[Mailer] SMTP transporter ready.');
  }
});

module.exports = transporter;
