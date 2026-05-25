#!/usr/bin/env node
/**
 * Seed script to create an admin user in the database
 * Run: node seedAdmin.js
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');

dotenv.config();

(async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    // Check if admin already exists
    const adminExists = await User.findOne({ email: '123@admin.com' });
    if (adminExists) {
      console.log('⚠️ Admin user already exists:', adminExists.email);
      process.exit(0);
    }

    // Create admin user
    const adminUser = await User.create({
      name: 'Admin',
      email: '123@admin.com',
      password: '123456',
      role: 'admin',
    });

    console.log('✅ Admin user created successfully!');
    console.log('   Email:', adminUser.email);
    console.log('   Name:', adminUser.name);
    console.log('   Role:', adminUser.role);

    process.exit(0);
  } catch (err) {
    console.error('❌ Error creating admin user:', err.message);
    process.exit(1);
  }
})();
