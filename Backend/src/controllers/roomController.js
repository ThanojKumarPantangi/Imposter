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

export const getActiveRoom = async (req, res) => {
  try {
    const playerId = req.query.playerId;
    if (!playerId) {
      return res.status(400).json({ success: false, error: 'Player ID required' });
    }

    const roomCode = await roomRepository.getPlayerRoomMapping(playerId);
    if (!roomCode) {
      return res.json({ success: true, activeRoom: null });
    }

    const room = await roomRepository.getRoom(roomCode);
    if (!room) {
      await roomRepository.removePlayerRoomMapping(playerId);
      return res.json({ success: true, activeRoom: null });
    }

    const player = room.players.find(p => p.id === playerId);
    if (!player || player.permanentlyDeparted) {
      await roomRepository.removePlayerRoomMapping(playerId);
      return res.json({ success: true, activeRoom: null });
    }

    const sanitized = gameEngine.sanitizeRoomForPlayer(room, playerId);
    return res.json({ success: true, roomCode, activeRoom: sanitized });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const leaveRoom = async (req, res) => {
  try {
    const { roomCode, playerId } = req.body;
    if (!roomCode || !playerId) {
      return res.status(400).json({ success: false, error: 'Room code and Player ID required' });
    }

    const result = await gameEngine.leaveRoom(roomCode, playerId);
    return res.json({ success: true, ...result });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const returnToLobby = async (req, res) => {
  try {
    const { roomCode, playerId } = req.body;
    if (!roomCode || !playerId) {
      return res.status(400).json({ success: false, error: 'Room code and Player ID required' });
    }

    const room = await gameEngine.returnToLobby(roomCode, playerId);
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
      .select('id numericId slug name group icon iconKey description tags minPlayableWords wordsCount displayOrder featured words')
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
  getActiveRoom,
  leaveRoom,
  returnToLobby,
  getRoom,
  getCategories
};
