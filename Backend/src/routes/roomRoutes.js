import express from 'express';
import {
  createRoom,
  joinRoom,
  getActiveRoom,
  leaveRoom,
  returnToLobby,
  getCategories,
  getRoom,
  updateSettings,
  updateRoomCategories,
  updatePlayerCategories
} from '../controllers/roomController.js';

const router = express.Router();

router.post('/create', createRoom);
router.post('/join', joinRoom);
router.get('/active', getActiveRoom);
router.post('/leave', leaveRoom);
router.post('/return-to-lobby', returnToLobby);
router.post('/settings', updateSettings);
router.post('/categories', updateRoomCategories);
router.post('/player-categories', updatePlayerCategories);
router.get('/categories', getCategories);
router.get('/:roomCode', getRoom);

export default router;
