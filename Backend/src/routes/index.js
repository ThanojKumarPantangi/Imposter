import express from 'express';
import authRoutes from './authRoutes.js';
import roomRoutes from './roomRoutes.js';
import adminRoutes from './adminRoutes.js';
import statsRoutes from './statsRoutes.js';

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/rooms', roomRoutes);
router.use('/admin', adminRoutes);
router.use('/stats', statsRoutes);

router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'imposter-multiplayer-backend'
  });
});

export default router;
