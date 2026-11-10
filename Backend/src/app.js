import express from 'express';
import cors from 'cors';
import apiRoutes from './routes/index.js';
import { checkServerMaintenance } from './controllers/appConfigController.js';

const app = express();

const rawClientUrls = process.env.CLIENT_URL || 'http://localhost:5173,http://localhost:5174';
const clientUrls = rawClientUrls.split(',').map(url => url.trim()).filter(Boolean);
if (!clientUrls.includes('http://localhost:5173')) clientUrls.push('http://localhost:5173');
if (!clientUrls.includes('http://localhost:5174')) clientUrls.push('http://localhost:5174');

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (clientUrls.includes(origin) || process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logger
app.use((req, res, next) => {
  if (process.env.NODE_ENV !== 'test') {
    console.log(`[HTTP] ${req.method} ${req.path}`);
  }
  next();
});

// Server Maintenance Guard (bypasses admin routes and public app config)
app.use(checkServerMaintenance);

// Mount /api/v1
app.use('/api/v1', apiRoutes);

// Health check root
app.get('/', (req, res) => {
  res.json({
    name: 'Imposter Multiplayer Party Game API',
    version: '1.0.0',
    status: 'online',
    docs: '/api/v1/health'
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error'
  });
});

export default app;
