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
        await this.clearGameDisconnectTimer(normalizedCode, p.id);
      }
    }

    // Delete timer keys
    await this.clearTurnTimer(normalizedCode);

    // Delete room state and room code from active index
    await redis.del(`room:${normalizedCode}`);
    await redis.srem('active_room_codes', normalizedCode);

    // Also scan and delete any lingering timer keys for this room
    try {
      const lingeringKeys = await redis.keys(`*:*:${normalizedCode}:*`);
      if (lingeringKeys && lingeringKeys.length > 0) {
        await redis.del(...lingeringKeys);
      }
      const lingeringRoomKeys = await redis.keys(`*:${normalizedCode}`);
      if (lingeringRoomKeys && lingeringRoomKeys.length > 0) {
        // don't delete other unrelated keys
        const keysToDelete = lingeringRoomKeys.filter(k => k.startsWith('timer:') || k.startsWith('voice:'));
        if (keysToDelete.length > 0) {
          await redis.del(...keysToDelete);
        }
      }
    } catch (e) {
      // ignore keys scan errors in restricted environments
    }
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
    const key = `timer:disconnect:lobby:${roomCode.toUpperCase()}:${playerId}`;
    await redis.set(key, deadline.toString(), 'EX', timeoutSeconds + 10);
    return deadline;
  }

  async getLobbyDisconnectTimer(roomCode, playerId) {
    if (!roomCode || !playerId) return null;
    const redis = getRedisClient();
    const val = await redis.get(`timer:disconnect:lobby:${roomCode.toUpperCase()}:${playerId}`);
    return val ? parseInt(val, 10) : null;
  }

  async clearLobbyDisconnectTimer(roomCode, playerId) {
    if (!roomCode || !playerId) return;
    const redis = getRedisClient();
    await redis.del(`timer:disconnect:lobby:${roomCode.toUpperCase()}:${playerId}`);
    // Also check legacy key
    await redis.del(`timer:disconnect:${roomCode.toUpperCase()}:${playerId}`);
  }

  /**
   * Game disconnect grace period timer (persisted in Redis)
   */
  async setGameDisconnectTimer(roomCode, playerId, timeoutSeconds = 30) {
    if (!roomCode || !playerId) return null;
    const redis = getRedisClient();
    const deadline = Date.now() + (timeoutSeconds * 1000);
    const key = `timer:disconnect:game:${roomCode.toUpperCase()}:${playerId}`;
    await redis.set(key, deadline.toString(), 'EX', timeoutSeconds + 10);
    return deadline;
  }

  async getGameDisconnectTimer(roomCode, playerId) {
    if (!roomCode || !playerId) return null;
    const redis = getRedisClient();
    const val = await redis.get(`timer:disconnect:game:${roomCode.toUpperCase()}:${playerId}`);
    return val ? parseInt(val, 10) : null;
  }

  async clearGameDisconnectTimer(roomCode, playerId) {
    if (!roomCode || !playerId) return;
    const redis = getRedisClient();
    await redis.del(`timer:disconnect:game:${roomCode.toUpperCase()}:${playerId}`);
  }

  /**
   * Turn timer tracking in Redis
   */
  async setTurnTimer(roomCode, deadline, timeoutSeconds = 30) {
    if (!roomCode) return;
    const redis = getRedisClient();
    await redis.set(`timer:turn:${roomCode.toUpperCase()}`, deadline.toString(), 'EX', timeoutSeconds + 10);
  }

  async clearTurnTimer(roomCode) {
    if (!roomCode) return;
    const redis = getRedisClient();
    await redis.del(`timer:turn:${roomCode.toUpperCase()}`);
  }

  /**
   * Get all active room codes from Redis
   */
  async getAllActiveRoomCodes() {
    const redis = getRedisClient();
    return await redis.smembers('active_room_codes');
  }

  /**
   * Pending Rejoin Request (Authoritative in Redis with TTL)
   */
  async setRejoinRequest(roomCode, playerId, requestData, ttlSeconds = 45) {
    if (!roomCode || !playerId) return;
    const redis = getRedisClient();
    const key = `rejoin_req:${roomCode.toUpperCase()}:${playerId}`;
    await redis.set(key, JSON.stringify(requestData), 'EX', ttlSeconds);
  }

  async getRejoinRequest(roomCode, playerId) {
    if (!roomCode || !playerId) return null;
    const redis = getRedisClient();
    const key = `rejoin_req:${roomCode.toUpperCase()}:${playerId}`;
    const raw = await redis.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async clearRejoinRequest(roomCode, playerId) {
    if (!roomCode || !playerId) return;
    const redis = getRedisClient();
    const key = `rejoin_req:${roomCode.toUpperCase()}:${playerId}`;
    await redis.del(key);
  }
}

const roomRepository = new RoomRepository();
export default roomRepository;
