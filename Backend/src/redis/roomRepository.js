import { getRedisClient, REDIS_TTL } from '../config/redis.js';

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
   * @param {number} [ttlSeconds=REDIS_TTL.ROOM]
   */
  async saveRoom(roomCode, roomData, ttlSeconds = REDIS_TTL.ROOM) {
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

    // Delete timer and chat keys
    await this.clearTurnTimer(normalizedCode);
    await this.clearVotingTimer(normalizedCode);
    await this.clearVoiceParticipants(normalizedCode);
    await this.clearRoomChat(normalizedCode);

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
    await redis.set(`player:room:${playerId}`, roomCode.toUpperCase(), 'EX', REDIS_TTL.PLAYER_ROOM);
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
    await redis.set(`socket:player:${socketId}`, playerId, 'EX', REDIS_TTL.SOCKET_MAPPING);
    await redis.set(`player:socket:${playerId}`, socketId, 'EX', REDIS_TTL.SOCKET_MAPPING);
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
      const activeSocketId = await this.getSocketByPlayer(playerId);
      // Only delete player:socket if it still points to this socketId
      if (activeSocketId === socketId) {
        await redis.del(`player:socket:${playerId}`);
      }
    }
    await redis.del(`socket:player:${socketId}`);
  }

  /**
   * Lobby disconnect timers (persisted in Redis)
   */
  async setLobbyDisconnectTimer(roomCode, playerId, timeoutSeconds = REDIS_TTL.LOBBY_DISCONNECT) {
    if (!roomCode || !playerId) return null;
    const redis = getRedisClient();
    const deadline = Date.now() + (timeoutSeconds * 1000);
    const key = `timer:disconnect:lobby:${roomCode.toUpperCase()}:${playerId}`;
    await redis.set(key, deadline.toString(), 'EX', timeoutSeconds + REDIS_TTL.TIMER_BUFFER);
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
  async setGameDisconnectTimer(roomCode, playerId, timeoutSeconds = REDIS_TTL.GAME_DISCONNECT) {
    if (!roomCode || !playerId) return null;
    const redis = getRedisClient();
    const deadline = Date.now() + (timeoutSeconds * 1000);
    const key = `timer:disconnect:game:${roomCode.toUpperCase()}:${playerId}`;
    await redis.set(key, deadline.toString(), 'EX', timeoutSeconds + REDIS_TTL.TIMER_BUFFER);
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
  async setTurnTimer(roomCode, deadline, timeoutSeconds = REDIS_TTL.TURN_TIMER) {
    if (!roomCode) return;
    const redis = getRedisClient();
    await redis.set(`timer:turn:${roomCode.toUpperCase()}`, deadline.toString(), 'EX', timeoutSeconds + REDIS_TTL.TIMER_BUFFER);
  }

  async getTurnTimer(roomCode) {
    if (!roomCode) return null;
    const redis = getRedisClient();
    const val = await redis.get(`timer:turn:${roomCode.toUpperCase()}`);
    return val ? parseInt(val, 10) : null;
  }

  async clearTurnTimer(roomCode) {
    if (!roomCode) return;
    const redis = getRedisClient();
    await redis.del(`timer:turn:${roomCode.toUpperCase()}`);
  }

  /**
   * Voting timer tracking in Redis
   */
  async setVotingTimer(roomCode, deadline, timeoutSeconds = REDIS_TTL.VOTING_TIMER) {
    if (!roomCode) return;
    const redis = getRedisClient();
    await redis.set(`timer:voting:${roomCode.toUpperCase()}`, deadline.toString(), 'EX', timeoutSeconds + REDIS_TTL.TIMER_BUFFER);
  }

  async getVotingTimer(roomCode) {
    if (!roomCode) return null;
    const redis = getRedisClient();
    const val = await redis.get(`timer:voting:${roomCode.toUpperCase()}`);
    return val ? parseInt(val, 10) : null;
  }

  async clearVotingTimer(roomCode) {
    if (!roomCode) return;
    const redis = getRedisClient();
    await redis.del(`timer:voting:${roomCode.toUpperCase()}`);
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
  async setRejoinRequest(roomCode, playerId, requestData, ttlSeconds = REDIS_TTL.REJOIN_REQUEST) {
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

  /**
   * Voice Chat Participants Tracking in Redis
   */
  async addVoiceParticipant(roomCode, playerId, socketId) {
    if (!roomCode || !playerId || !socketId) return;
    const redis = getRedisClient();
    const key = `voice:participants:${roomCode.toUpperCase()}`;
    const raw = await redis.get(key);
    let participants = {};
    if (raw) {
      try {
        participants = typeof raw === 'string' ? JSON.parse(raw) : raw;
      } catch {
        participants = {};
      }
    }
    participants[playerId] = socketId;
    await redis.set(key, JSON.stringify(participants), 'EX', REDIS_TTL.VOICE_PARTICIPANTS);
  }

  async getVoiceParticipants(roomCode) {
    if (!roomCode) return [];
    const redis = getRedisClient();
    const key = `voice:participants:${roomCode.toUpperCase()}`;
    const raw = await redis.get(key);
    if (!raw) return [];
    try {
      const participants = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return Object.entries(participants).map(([playerId, socketId]) => ({
        playerId,
        socketId
      }));
    } catch {
      return [];
    }
  }

  async removeVoiceParticipant(roomCode, playerId) {
    if (!roomCode || !playerId) return;
    const redis = getRedisClient();
    const key = `voice:participants:${roomCode.toUpperCase()}`;
    const raw = await redis.get(key);
    if (!raw) return;
    try {
      const participants = typeof raw === 'string' ? JSON.parse(raw) : raw;
      delete participants[playerId];
      await redis.set(key, JSON.stringify(participants), 'EX', REDIS_TTL.VOICE_PARTICIPANTS);
    } catch {
      // ignore
    }
  }

  async clearVoiceParticipants(roomCode) {
    if (!roomCode) return;
    const redis = getRedisClient();
    await redis.del(`voice:participants:${roomCode.toUpperCase()}`);
  }

  /**
   * Save a chat message to the channel's message list in Redis
   * @param {string} roomCode 
   * @param {string} channel 'LOBBY_GLOBAL' | 'GAME_GLOBAL' | 'GAME_IMPOSTER' | 'GAME_CIVILIAN'
   * @param {Object} message 
   * @param {number} [maxHistory=100]
   */
  async saveChatMessage(roomCode, channel, message, maxHistory = 100) {
    if (!roomCode || !channel || !message) return;
    const redis = getRedisClient();
    const key = `chat:${roomCode.toUpperCase()}:${channel}`;
    const raw = await redis.get(key);
    let messages = [];
    if (raw) {
      try {
        messages = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (!Array.isArray(messages)) messages = [];
      } catch (e) {
        messages = [];
      }
    }
    messages.push(message);
    if (messages.length > maxHistory) {
      messages = messages.slice(-maxHistory);
    }
    await redis.set(key, JSON.stringify(messages), 'EX', REDIS_TTL.ROOM);
  }

  /**
   * Fetch chat history for a channel
   * @param {string} roomCode 
   * @param {string} channel 
   * @returns {Promise<Array>}
   */
  async getChatHistory(roomCode, channel) {
    if (!roomCode || !channel) return [];
    const redis = getRedisClient();
    const key = `chat:${roomCode.toUpperCase()}:${channel}`;
    const raw = await redis.get(key);
    if (!raw) return [];
    try {
      const messages = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return Array.isArray(messages) ? messages : [];
    } catch (e) {
      return [];
    }
  }

  /**
   * Clear only the active game chat channels (GAME_GLOBAL, GAME_IMPOSTER, GAME_CIVILIAN),
   * preserving the Lobby Global Chat.
   * @param {string} roomCode 
   */
  async clearGameChats(roomCode) {
    if (!roomCode) return;
    const redis = getRedisClient();
    const normalized = roomCode.toUpperCase();
    const gameChannels = ['GAME_GLOBAL', 'GAME_IMPOSTER', 'GAME_CIVILIAN'];
    for (const ch of gameChannels) {
      await redis.del(`chat:${normalized}:${ch}`);
    }
    // Also delete any session-scoped chat keys
    try {
      const lingeringChatKeys = await redis.keys(`chat:${normalized}:game_*`);
      if (lingeringChatKeys && lingeringChatKeys.length > 0) {
        await redis.del(...lingeringChatKeys);
      }
    } catch {
      // ignore
    }
  }

  /**
   * Clear all chat channels for a room
   * @param {string} roomCode 
   */
  async clearRoomChat(roomCode) {
    if (!roomCode) return;
    const redis = getRedisClient();
    const normalized = roomCode.toUpperCase();
    await this.clearGameChats(normalized);
    await redis.del(`chat:${normalized}:LOBBY_GLOBAL`);
  }
}

const roomRepository = new RoomRepository();
export default roomRepository;
