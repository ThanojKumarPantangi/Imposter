import gameEngine from '../services/gameEngine.js';
import roomRepository from '../redis/roomRepository.js';
import Category from '../models/Category.js';

export const createRoom = async (req, res) => {
  try {
    const { player, settings } = req.body;
    if (!player || !player.id || !player.username) {
      return res.status(400).json({ success: false, error: 'Valid player profile required to create room' });
    }

    const room = await gameEngine.createRoom(player, settings || {});
    return res.json({ success: true, room });
  } catch (error) {
    console.error('Error creating room:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const joinRoom = async (req, res) => {
  try {
    const { roomCode, player } = req.body;
    if (!roomCode || !player || !player.id || !player.username) {
      return res.status(400).json({ success: false, error: 'Room code and player profile are required' });
    }

    const room = await gameEngine.joinRoom(roomCode, player);
    return res.json({ success: true, room });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
};

export const getRoom = async (req, res) => {
  try {
    const { roomCode } = req.params;
    const playerId = req.query.playerId;
    const room = await roomRepository.getRoom(roomCode);
    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }

    const sanitized = playerId ? gameEngine.sanitizeRoomForPlayer(room, playerId) : room;
    return res.json({ success: true, room: sanitized });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const getCategories = async (req, res) => {
  try {
    const categories = await Category.find({ status: 'PUBLISHED' })
      .select('id numericId slug name group icon iconKey description tags minPlayableWords wordsCount displayOrder featured')
      .sort({ displayOrder: 1, name: 1 })
      .lean();

    return res.json({ success: true, categories });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

export default {
  createRoom,
  joinRoom,
  getRoom,
  getCategories
};
