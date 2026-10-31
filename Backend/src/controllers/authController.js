import authService from '../services/authService.js';
import roomRepository from '../redis/roomRepository.js';
import Guest from '../models/Guest.js';

export const registerOrRestore = async (req, res) => {
  try {
    const { deviceId, username, avatar } = req.body;
    const result = await authService.registerOrRestoreDevice(deviceId, username, avatar);
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error in registerOrRestore:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const updateUsername = async (req, res) => {
  try {
    const { deviceId, username } = req.body;
    const result = await authService.updateUsername(deviceId, username);

    // Sync updated username to active room in Redis if player is currently in a room
    if (result && result.player && result.player.id) {
      const roomCode = await roomRepository.getPlayerRoomMapping(result.player.id);
      if (roomCode) {
        const room = await roomRepository.getRoom(roomCode);
        if (room) {
          const p = room.players.find(x => x.id === result.player.id);
          if (p) {
            p.username = result.player.username;
            if (room.clueHistory) {
              room.clueHistory.forEach(c => {
                if (c.playerId === result.player.id) c.username = result.player.username;
              });
            }
            await roomRepository.saveRoom(roomCode, room);
          }
        }
      }
    }

    return res.json({ success: true, ...result });
  } catch (error) {
    return res.status(400).json({ success: false, error: error.message });
  }
};

export const getProfile = async (req, res) => {
  try {
    const deviceId = req.query.deviceId || (req.user && req.user.deviceId);
    if (!deviceId) {
      return res.status(400).json({ success: false, error: 'Device ID required' });
    }
    const guest = await Guest.findOne({ deviceId });
    if (!guest) {
      return res.status(404).json({ success: false, error: 'Profile not found' });
    }
    return res.json({
      success: true,
      player: {
        id: guest._id.toString(),
        deviceId: guest.deviceId,
        username: guest.username,
        avatar: guest.avatar,
        stats: guest.stats
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const result = await authService.loginAdmin(email, password, ip);
    return res.json({ success: true, ...result });
  } catch (error) {
    return res.status(401).json({ success: false, error: error.message });
  }
};

export default {
  registerOrRestore,
  updateUsername,
  getProfile,
  adminLogin
};
