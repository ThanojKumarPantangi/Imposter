import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Redis from 'ioredis';
import { Redis as UpstashRedis } from '@upstash/redis';
import { EventEmitter } from 'events';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Explicitly load Backend/.env regardless of process current working directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
if (!process.env.REDIS_URL) {
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
  dotenv.config({ path: path.resolve(process.cwd(), 'Backend/.env') });
}

let redisClient = null;

export const isRedisConfigured = () => {
  const url = process.env.REDIS_URL || '';
  return Boolean(url && !url.includes('<password>') && !url.includes('<host>'));
};

export const isUsingUpstash = () => {
  const url = process.env.REDIS_URL || '';
  return url.includes('upstash.io');
};

/**
 * Adapter wrapping Upstash REST client to provide standard ioredis-compatible API
 */
class UpstashAdapter {
  constructor(upstashClient) {
    this.client = upstashClient;
    this.status = 'ready';
  }

  async get(key) {
    try {
      const val = await this.client.get(key);
      if (val === null || val === undefined) return null;
      return typeof val === 'object' ? JSON.stringify(val) : String(val);
    } catch (err) {
      console.error(`[Upstash] GET error for key ${key}:`, err.message);
      return null;
    }
  }

  async set(key, val, ...args) {
    try {
      let ex = undefined;
      if (args.length >= 2 && String(args[0]).toUpperCase() === 'EX') {
        ex = Number(args[1]);
      } else if (args.length === 1 && typeof args[0] === 'object' && args[0].ex) {
        ex = Number(args[0].ex);
      }

      const strVal = typeof val === 'string' ? val : JSON.stringify(val);
      if (ex) {
        return await this.client.set(key, strVal, { ex });
      }
      return await this.client.set(key, strVal);
    } catch (err) {
      console.error(`[Upstash] SET error for key ${key}:`, err.message);
      return null;
    }
  }

  async del(...keys) {
    try {
      if (!keys || keys.length === 0) return 0;
      return await this.client.del(...keys);
    } catch (err) {
      console.error(`[Upstash] DEL error:`, err.message);
      return 0;
    }
  }

  async expire(key, seconds) {
    try {
      return await this.client.expire(key, seconds);
    } catch (err) {
      return 0;
    }
  }

  async sadd(key, ...members) {
    try {
      return await this.client.sadd(key, ...members);
    } catch (err) {
      return 0;
    }
  }

  async srem(key, ...members) {
    try {
      return await this.client.srem(key, ...members);
    } catch (err) {
      return 0;
    }
  }

  async smembers(key) {
    try {
      const res = await this.client.smembers(key);
      return Array.isArray(res) ? res : [];
    } catch (err) {
      return [];
    }
  }

  async keys(pattern) {
    try {
      const res = await this.client.keys(pattern);
      return Array.isArray(res) ? res : [];
    } catch (err) {
      return [];
    }
  }

  async flushall() {
    try {
      return await this.client.flushall();
    } catch (err) {
      return 'OK';
    }
  }

  duplicate() {
    return new UpstashAdapter(this.client);
  }
}

export const createRedisClient = () => {
  const redisUrl = process.env.REDIS_URL || '';

  if (!isRedisConfigured()) {
    console.warn('\n⚠️ [Redis] REDIS_URL is not fully configured in Backend/.env. Using in-memory fallback.');
    const store = new Map();
    class MockRedis extends EventEmitter {
      constructor() {
        super();
        this.status = 'mock';
      }
      async get(key) { return store.get(key) || null; }
      async set(key, val) {
        store.set(key, typeof val === 'string' ? val : JSON.stringify(val));
        return 'OK';
      }
      async del(...keys) {
        let count = 0;
        for (const k of keys) {
          if (store.delete(k)) count++;
        }
        return count;
      }
      async expire() { return 1; }
      async keys(pattern) {
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        return Array.from(store.keys()).filter(k => regex.test(k));
      }
      async sadd() { return 1; }
      async srem() { return 1; }
      async smembers() { return []; }
      async flushall() { store.clear(); return 'OK'; }
      duplicate() { return new MockRedis(); }
    }
    return new MockRedis();
  }

  // If Upstash Cloud Redis is detected:
  // Connect via HTTPS (Port 443) using official Upstash SDK.
  // This bypasses port 6379 firewall/ISP blocks and prevents ETIMEDOUT!
  if (isUsingUpstash()) {
    try {
      const parsed = new URL(redisUrl);
      const restUrl = `https://${parsed.hostname}`;
      const token = parsed.password;

      const upstashClient = new UpstashRedis({
        url: restUrl,
        token: token
      });

      console.log('✅ [Redis] Connected to Upstash Cloud Redis over HTTPS (Port 443 - Firewall safe)');
      return new UpstashAdapter(upstashClient);
    } catch (e) {
      console.warn('⚠️ [Redis] Error initializing Upstash client, falling back to ioredis:', e.message);
    }
  }

  // Fallback for standard local or non-Upstash Redis instances
  const options = {
    maxRetriesPerRequest: 1,
    connectTimeout: 5000,
    retryStrategy(times) {
      return Math.min(times * 1000, 5000);
    }
  };

  if (redisUrl.startsWith('rediss://')) {
    options.tls = {
      rejectUnauthorized: false
    };
  }

  const client = new Redis(redisUrl, options);

  client.on('connect', () => {
    console.log('🔄 [Redis] Connecting to cloud instance...');
  });

  client.on('ready', () => {
    console.log('✅ [Redis] Connected and ready to process state operations');
  });

  client.on('error', (err) => {
    console.warn(`⚠️ [Redis] Connection warning: ${err.message}`);
  });

  return client;
};

export const getRedisClient = () => {
  if (!redisClient) {
    redisClient = createRedisClient();
  }
  return redisClient;
};

export default {
  getRedisClient,
  createRedisClient,
  isRedisConfigured,
  isUsingUpstash
};
