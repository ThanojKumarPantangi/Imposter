import { getRedisClient } from '../config/redis.js';

class RoomRepository {
  /**
   * Fetch active room state from Redis
   * @param {string} roomCode 
   * @returns {Promise<Object|null>}
   */
  async getRoom(roomCode) {
    if (!roomCode) return null;
    const redis = getRedisClient();
    const data = await redis.get(`room:${roomCode.toUpperCase()}`);
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch (e) {
      console.error(`Error parsing room JSON for ${roomCode}:`, e);
      return null;
    }
  }

  /**
   * Save active room state to Redis with TTL
   * @param {string} roomCode 
   * @param {Object} roomData 
   * @param {number} ttlSeconds Default 24 hours (86400)
   */
  async saveRoom(roomCode, roomData, ttlSeconds = 86400) {
    if (!roomCode || !roomData) return;
    const redis = getRedisClient();
    const normalizedCode = roomCode.toUpperCase();
    roomData.updatedAt = Date.now();
    await redis.set(`room:${normalizedCode}`, JSON.stringify(roomData), 'EX', ttlSeconds);
    // Keep an index of active room codes
    await redis.sadd('active_room_codes', normalizedCode);
  }

  /**
   * Delete room and cleanup Redis keys
   * @param {string} roomCode 
   */
  async deleteRoom(roomCode) {
    if (!roomCode) return;
    const redis = getRedisClient();
    const normalizedCode = roomCode.toUpperCase();
    const room = await this.getRoom(normalizedCode);

    if (room && room.players) {
      for (const p of room.players) {
        await this.removePlayerRoomMapping(p.id);
        await this.clearLobbyDisconnectTimer(normalizedCode, p.id);
      }
    }

    await redis.del(`room:${normalizedCode}`);
    await redis.srem('active_room_codes', normalizedCode);
  }

  /**
   * Map Player ID to their current active Room Code
   */
  async setPlayerRoomMapping(playerId, roomCode) {
    if (!playerId || !roomCode) return;
    const redis = getRedisClient();
    await redis.set(`player:room:${playerId}`, roomCode.toUpperCase(), 'EX', 86400);
  }

  async getPlayerRoomMapping(playerId) {
    if (!playerId) return null;
    const redis = getRedisClient();
    return await redis.get(`player:room:${playerId}`);
  }

  async removePlayerRoomMapping(playerId) {
    if (!playerId) return;
    const redis = getRedisClient();
    await redis.del(`player:room:${playerId}`);
  }

  /**
   * Map Socket ID to Player ID
   */
  async mapSocketToPlayer(socketId, playerId) {
    if (!socketId || !playerId) return;
    const redis = getRedisClient();
    await redis.set(`socket:player:${socketId}`, playerId, 'EX', 86400);
    await redis.set(`player:socket:${playerId}`, socketId, 'EX', 86400);
  }

  async getPlayerBySocket(socketId) {
    if (!socketId) return null;
    const redis = getRedisClient();
    return await redis.get(`socket:player:${socketId}`);
  }

  async getSocketByPlayer(playerId) {
    if (!playerId) return null;
    const redis = getRedisClient();
    return await redis.get(`player:socket:${playerId}`);
  }

  async removeSocketMapping(socketId) {
    if (!socketId) return;
    const redis = getRedisClient();
    const playerId = await this.getPlayerBySocket(socketId);
    if (playerId) {
      await redis.del(`player:socket:${playerId}`);
    }
    await redis.del(`socket:player:${socketId}`);
  }

  /**
   * Lobby disconnect timers (persisted in Redis)
   */
  async setLobbyDisconnectTimer(roomCode, playerId, timeoutSeconds = 5) {
    if (!roomCode || !playerId) return null;
    const redis = getRedisClient();
    const deadline = Date.now() + (timeoutSeconds * 1000);
    const key = `timer:disconnect:${roomCode.toUpperCase()}:${playerId}`;
    await redis.set(key, deadline.toString(), 'EX', timeoutSeconds + 10);
    return deadline;
  }

  async getLobbyDisconnectTimer(roomCode, playerId) {
    if (!roomCode || !playerId) return null;
    const redis = getRedisClient();
    const val = await redis.get(`timer:disconnect:${roomCode.toUpperCase()}:${playerId}`);
    return val ? parseInt(val, 10) : null;
  }

  async clearLobbyDisconnectTimer(roomCode, playerId) {
    if (!roomCode || !playerId) return;
    const redis = getRedisClient();
    await redis.del(`timer:disconnect:${roomCode.toUpperCase()}:${playerId}`);
  }

  /**
   * Get all active room codes from Redis
   */
  async getAllActiveRoomCodes() {
    const redis = getRedisClient();
    return await redis.smembers('active_room_codes');
  }
}

const roomRepository = new RoomRepository();
export default roomRepository;
