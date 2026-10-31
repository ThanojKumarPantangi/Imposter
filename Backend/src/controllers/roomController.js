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
    if (error.code === 'KICKED_REJOIN_REQUIRES_APPROVAL' || error.requiresApproval) {
      return res.status(403).json({
        success: false,
        kicked: true,
        requiresApproval: true,
        error: error.message
      });
    }
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

export const updateSettings = async (req, res) => {
  try {
    const { roomCode, hostId, settings } = req.body;
    if (!roomCode || !hostId) {
      return res.status(400).json({ success: false, error: 'Room code and host ID are required' });
    }
    const room = await roomRepository.getRoom(roomCode.toUpperCase());
    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }
    if (room.hostId !== hostId) {
      return res.status(403).json({ success: false, error: 'Unauthorized: Only the room host can modify settings' });
    }
    const updated = await gameEngine.updateSettings(roomCode.toUpperCase(), hostId, settings || {});
    return res.json({ success: true, settings: updated.settings });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
};

export const updateRoomCategories = async (req, res) => {
  try {
    const { roomCode, playerId, categorySlugs, categoryNames } = req.body;
    if (!roomCode || !playerId) {
      return res.status(400).json({ success: false, error: 'Room code and player ID are required' });
    }
    const result = await gameEngine.updateRoomCategories(
      roomCode.toUpperCase(),
      playerId,
      categorySlugs,
      categoryNames
    );
    return res.json({
      success: true,
      categorySlugs: result.categorySlugs,
      categoryNames: result.categoryNames,
      selectedCategories: result.categorySlugs,
      settings: result.room.settings
    });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
};

export const updatePlayerCategories = updateRoomCategories;

export const requestRejoin = async (req, res) => {
  try {
    const { roomCode, player } = req.body;
    const request = await gameEngine.createRejoinRequest(roomCode, player);
    return res.json({ success: true, request });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
};

export const approveRejoin = async (req, res) => {
  try {
    const { roomCode, hostId, targetPlayerId, requestId } = req.body;
    const result = await gameEngine.approveRejoin(roomCode, hostId, targetPlayerId, requestId);
    return res.json({ success: true, room: result.room, player: result.player });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
};

export const denyRejoin = async (req, res) => {
  try {
    const { roomCode, hostId, targetPlayerId, requestId } = req.body;
    const result = await gameEngine.denyRejoin(roomCode, hostId, targetPlayerId, requestId);
    return res.json({ success: true, ...result });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
};

export const getRejoinStatus = async (req, res) => {
  try {
    const { roomCode, playerId } = req.query;
    const result = await gameEngine.getRejoinStatus(roomCode, playerId);
    return res.json({ success: true, ...result });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
};

export default {
  createRoom,
  joinRoom,
  getActiveRoom,
  leaveRoom,
  returnToLobby,
  getRoom,
  getCategories,
  updateSettings,
  updateRoomCategories,
  updatePlayerCategories,
  requestRejoin,
  approveRejoin,
  denyRejoin,
  getRejoinStatus
};
