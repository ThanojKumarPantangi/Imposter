import { apiRequest } from './client';

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

  getCategories: () => {
    return apiRequest('/rooms/categories');
  },

  updateSettings: (roomCode, hostId, settings) => {
    return apiRequest('/rooms/settings', {
      method: 'POST',
      body: JSON.stringify({ roomCode, hostId, settings })
    });
  },

  updatePlayerCategories: (roomCode, playerId, categorySlugs, categoryNames) => {
    return apiRequest('/rooms/player-categories', {
      method: 'POST',
      body: JSON.stringify({ roomCode, playerId, categorySlugs, categoryNames })
    });
  }
};
