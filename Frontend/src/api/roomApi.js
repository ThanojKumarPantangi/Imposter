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

  getRoom: (roomCode, playerId) => {
    const q = playerId ? `?playerId=${encodeURIComponent(playerId)}` : '';
    return apiRequest(`/rooms/${encodeURIComponent(roomCode)}${q}`);
  },

  getCategories: () => {
    return apiRequest('/rooms/categories');
  }
};
