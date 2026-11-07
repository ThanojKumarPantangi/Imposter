import Redis from 'ioredis';
import { Redis as UpstashRedis } from '@upstash/redis';
import { EventEmitter } from 'events';

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
      async sadd(key, ...members) {
        if (!store.has(key)) store.set(key, new Set());
        const set = store.get(key);
        if (set instanceof Set) {
          members.forEach(m => set.add(m));
          return members.length;
        }
        return 1;
      }
      async srem(key, ...members) {
        const set = store.get(key);
        if (set instanceof Set) {
          members.forEach(m => set.delete(m));
          return members.length;
        }
        return 1;
      }
      async smembers(key) {
        const set = store.get(key);
        if (set instanceof Set) {
          return Array.from(set);
        }
        return [];
      }
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

/**
 * Safely parse a positive integer from environment with a fallback default
 */
const parsePositiveInt = (val, defaultVal) => {
  if (val === undefined || val === null || val === '') return defaultVal;
  const parsed = parseInt(val, 10);
  return !isNaN(parsed) && parsed > 0 ? parsed : defaultVal;
};

/**
 * Configurable Redis key expiration (TTL) and timeout constants.
 * Dynamically reads from process.env with sensible defaults matching original hardcoded values.
 */
export const REDIS_TTL = {
  get ROOM() { return parsePositiveInt(process.env.REDIS_ROOM_TTL, 86400); },
  get PLAYER_ROOM() { return parsePositiveInt(process.env.REDIS_PLAYER_ROOM_TTL, 86400); },
  get SOCKET_MAPPING() { return parsePositiveInt(process.env.REDIS_SOCKET_MAPPING_TTL, 86400); },
  get REJOIN_REQUEST() { return parsePositiveInt(process.env.REDIS_REJOIN_REQUEST_TTL, 45); },
  get VOICE_PARTICIPANTS() { return parsePositiveInt(process.env.REDIS_VOICE_PARTICIPANTS_TTL, 86400); },
  get TIMER_BUFFER() { return parsePositiveInt(process.env.REDIS_TIMER_BUFFER_TTL, 10); },
  get LOBBY_DISCONNECT() { return parsePositiveInt(process.env.REDIS_LOBBY_DISCONNECT_TIMEOUT, 5); },
  get GAME_DISCONNECT() { return parsePositiveInt(process.env.REDIS_GAME_DISCONNECT_TIMEOUT, 30); },
  get TURN_TIMER() { return parsePositiveInt(process.env.REDIS_TURN_TIMER_TIMEOUT, 30); },
  get VOTING_TIMER() { return parsePositiveInt(process.env.REDIS_VOTING_TIMER_TIMEOUT, 45); }
};

export default {
  getRedisClient,
  createRedisClient,
  isRedisConfigured,
  isUsingUpstash,
  REDIS_TTL
};

