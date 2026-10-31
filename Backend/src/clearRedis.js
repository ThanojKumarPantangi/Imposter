import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { getRedisClient } from './config/redis.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

export async function clearRedis() {
  const redis = getRedisClient();
  console.log('🔄 Clearing all game keys from Redis...');
  try {
    const keys = await redis.keys('*');
    if (keys.length > 0) {
      console.log(`Found ${keys.length} keys in Redis. Deleting...`);
      await redis.del(...keys);
      console.log('✅ All keys successfully removed from Redis.');
    } else {
      console.log('ℹ️ Redis is already empty.');
    }
  } catch (error) {
    console.error('❌ Failed to clear Redis keys:', error);
  } finally {
    process.exit(0);
  }
}

if (process.argv[1] === __filename) {
  clearRedis();
}

export default clearRedis;
