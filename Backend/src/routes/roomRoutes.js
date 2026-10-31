import express from 'express';
import { createRoom, joinRoom, getCategories, getRoom } from '../controllers/roomController.js';

const router = express.Router();

router.post('/create', createRoom);
router.post('/join', joinRoom);
router.get('/categories', getCategories);
router.get('/:roomCode', getRoom);

export default router;
