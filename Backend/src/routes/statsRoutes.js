import express from 'express';
import { getLeaderboard, getPlayerStats } from '../controllers/statsController.js';

const router = express.Router();

router.get('/leaderboard', getLeaderboard);
router.get('/player/:playerId', getPlayerStats);

export default router;
