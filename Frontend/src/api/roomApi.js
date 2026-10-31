import { apiRequest } from './client';
import { getCachedCategories } from './categoryCache';

export const roomApi = {
  createRoom: (player, settings) => {
    return apiRequest('/rooms/create', {
      method: 'POST',
      body: JSON.stringify({ player, settings })
    });
  },

  joinRoom: (roomCode, player) => {
    return apiRequest('/rooms/join', {
      method: 'POST',
      body: JSON.stringify({ roomCode, player })
    });
  },

  getActiveRoom: (playerId) => {
    return apiRequest(`/rooms/active?playerId=${encodeURIComponent(playerId)}`);
  },

  leaveRoom: (roomCode, playerId) => {
    return apiRequest('/rooms/leave', {
      method: 'POST',
      body: JSON.stringify({ roomCode, playerId })
    });
  },

  returnToLobby: (roomCode, playerId) => {
    return apiRequest('/rooms/return-to-lobby', {
      method: 'POST',
      body: JSON.stringify({ roomCode, playerId })
    });
  },

  getRoom: (roomCode, playerId) => {
    const q = playerId ? `?playerId=${encodeURIComponent(playerId)}` : '';
    return apiRequest(`/rooms/${encodeURIComponent(roomCode)}${q}`);
  },

  // Centralized cached category definitions (called once, reused everywhere)
  getCategories: () => {
    return getCachedCategories();
  },

  updateSettings: (roomCode, hostId, settings) => {
    return apiRequest('/rooms/settings', {
      method: 'POST',
      body: JSON.stringify({ roomCode, hostId, settings })
    });
  },

  // Any player in lobby can update the shared room categories
  updateRoomCategories: (roomCode, playerId, categorySlugs, categoryNames) => {
    return apiRequest('/rooms/categories', {
      method: 'POST',
      body: JSON.stringify({ roomCode, playerId, categorySlugs, categoryNames })
    });
  },

  // Backward compatibility alias
  updatePlayerCategories: (roomCode, playerId, categorySlugs, categoryNames) => {
    return apiRequest('/rooms/categories', {
      method: 'POST',
      body: JSON.stringify({ roomCode, playerId, categorySlugs, categoryNames })
    });
  }
};
