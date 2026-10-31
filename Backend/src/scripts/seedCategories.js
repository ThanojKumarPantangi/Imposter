import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import Category from '../models/Category.js';
import AdminUser from '../models/AdminUser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const categoriesData = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, './categoriesData.json'), 'utf-8')
);

export async function seed() {
  const uri = process.env.MONGODB_URI;
  if (!uri || uri.includes('<username>') || uri.includes('<password>')) {
    console.error('❌ MONGODB_URI is not configured in Backend/.env. Please update it with your actual connection string.');
    return;
  }

  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(uri);
    console.log('✅ Connected to MongoDB.');

    // 1. Seed Categories
    console.log(`📦 Seeding ${categoriesData.length} categories...`);
    let created = 0;

    for (const cat of categoriesData) {
      const res = await Category.findOneAndUpdate(
        { id: cat.id },
        { ...cat },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      if (res) created++;
    }
    console.log(`✅ Successfully seeded/upserted ${created} categories into MongoDB.`);

    // 2. Seed Default Admin User
    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@imposter.game').toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD || 'AdminSecret123!';
    
    let admin = await AdminUser.findOne({ email: adminEmail });
    if (!admin) {
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(adminPassword, salt);
      admin = await AdminUser.create({
        email: adminEmail,
        passwordHash,
        role: 'SUPER_ADMIN'
      });
      console.log(`✅ Admin account created: ${adminEmail} (password: ${adminPassword})`);
    } else {
      console.log(`ℹ️ Admin account already exists: ${adminEmail}`);
    }

    console.log('🎉 Seeding completed successfully!');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB.');
  }
}

// Check if running as CLI script
if (process.argv[1] === __filename) {
  seed();
}

export default seed;
