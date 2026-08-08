/**
 * One-off script to create the first Admin account.
 * Run with: node utils/seedAdmin.js
 *
 * Prompts are hardcoded here for simplicity — edit the values below
 * or pass them as environment variables before running.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Admin = require('../models/Admin');

const ADMIN_NAME = process.env.SEED_ADMIN_NAME || 'Super Admin';
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@securecrypt.com';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'admin1234';

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const existing = await Admin.findOne({ email: ADMIN_EMAIL.toLowerCase() });
    if (existing) {
      console.log(`[Seed] Admin already exists: ${ADMIN_EMAIL}`);
      process.exit(0);
    }

    const admin = await Admin.create({
      name: ADMIN_NAME,
      email: ADMIN_EMAIL.toLowerCase(),
      password: ADMIN_PASSWORD,
      role: 'superadmin',
    });

    console.log('[Seed] Admin created successfully:');
    console.log(`  Email: ${admin.email}`);
    console.log(`  Password: ${ADMIN_PASSWORD} (change this after first login)`);
    process.exit(0);
  } catch (err) {
    console.error('[Seed] Failed:', err.message);
    process.exit(1);
  }
})();
