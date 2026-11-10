import http from 'http';
import { Server } from 'socket.io';
import app from './app.js';
import connectDB from './config/db.js';
import { getRedisClient, createRedisClient, isRedisConfigured, isUsingUpstash } from './config/redis.js';
import { registerGameSocket } from './sockets/gameSocket.js';

const PORT = process.env.PORT || 5000;
const rawClientUrls = process.env.CLIENT_URL || 'http://localhost:5173,http://localhost:5174';
const clientUrls = rawClientUrls.split(',').map(url => url.trim()).filter(Boolean);
if (!clientUrls.includes('http://localhost:5173')) clientUrls.push('http://localhost:5173');
if (!clientUrls.includes('http://localhost:5174')) clientUrls.push('http://localhost:5174');

const server = http.createServer(app);

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (clientUrls.includes(origin) || process.env.NODE_ENV !== 'production') {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST']
  },
  pingInterval: 10000,
  pingTimeout: 5000,
  transports: ['websocket', 'polling']
});

// Configure Redis adapter only if raw TCP Redis (non-Upstash) is configured
if (isRedisConfigured() && !isUsingUpstash() && process.env.REDIS_URL && !process.env.REDIS_URL.includes('<password>')) {
  try {
    const { createAdapter } = await import('@socket.io/redis-adapter');
    const pubClient = createRedisClient();
    const subClient = pubClient.duplicate();
    io.adapter(createAdapter(pubClient, subClient));
    console.log('📡 [Socket.IO] Redis adapter initialized for multi-instance scaling');
  } catch (err) {
    console.warn('⚠️ [Socket.IO] Redis adapter skipped:', err.message);
  }
}

// Register real-time game handlers
registerGameSocket(io);
app.set('io', io);

// Start server
async function startServer() {
  console.log('🚀 Starting Imposter Game Backend Server (ESM Mode)...');
  
  // 1. Connect MongoDB
  await connectDB();

  // 2. Init Redis Client (Upstash HTTPS or ioredis)
  getRedisClient();

  // 3. Listen
  server.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🎮 Imposter Multiplayer Server is RUNNING on port ${PORT}`);
    console.log(`🌐 REST API:    http://localhost:${PORT}/api/v1`);
    console.log(`⚡ Socket.IO:   ws://localhost:${PORT} and /game`);
    console.log(`🖥️ Frontend URL: ${clientUrl}`);
    console.log(`======================================================\n`);
  });
}

startServer().catch(err => {
  console.error('Fatal startup error:', err);
});
