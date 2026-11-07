import { apiRequest } from './client';
import { getCachedCategories } from './categoryCache';
import { Player, RoomState, RoomSettings, Category } from '../../types';

export const roomApi = {
  createRoom: (
    player: Player,
    settings: Partial<RoomSettings>
  ): Promise<{ success: boolean; room: RoomState }> => {
    return apiRequest('/rooms/create', {
      method: 'POST',
      body: JSON.stringify({ player, settings }),
    });
  },

  joinRoom: (
    roomCode: string,
    player: Player
  ): Promise<{ success: boolean; room: RoomState }> => {
    return apiRequest('/rooms/join', {
      method: 'POST',
      body: JSON.stringify({ roomCode, player }),
    });
  },

  getActiveRoom: (playerId: string): Promise<{ success: boolean; room: RoomState | null }> => {
    return apiRequest(`/rooms/active?playerId=${encodeURIComponent(playerId)}`);
  },

  leaveRoom: (roomCode: string, playerId: string): Promise<{ success: boolean }> => {
    return apiRequest('/rooms/leave', {
      method: 'POST',
      body: JSON.stringify({ roomCode, playerId }),
    });
  },

  returnToLobby: (roomCode: string, playerId: string): Promise<{ success: boolean }> => {
    return apiRequest('/rooms/return-to-lobby', {
      method: 'POST',
      body: JSON.stringify({ roomCode, playerId }),
    });
  },

  getRoom: (roomCode: string, playerId?: string): Promise<{ success: boolean; room: RoomState }> => {
    const q = playerId ? `?playerId=${encodeURIComponent(playerId)}` : '';
    return apiRequest(`/rooms/${encodeURIComponent(roomCode)}${q}`);
  },

  getCategories: (): Promise<Category[]> => {
    return getCachedCategories();
  },

  updateSettings: (
    roomCode: string,
    hostId: string,
    settings: Partial<RoomSettings>
  ): Promise<{ success: boolean; settings: RoomSettings }> => {
    return apiRequest('/rooms/settings', {
      method: 'POST',
      body: JSON.stringify({ roomCode, hostId, settings }),
    });
  },

  updateRoomCategories: (
    roomCode: string,
    playerId: string,
    categorySlugs: string[],
    categoryNames: string[]
  ): Promise<{ success: boolean }> => {
    return apiRequest('/rooms/categories', {
      method: 'POST',
      body: JSON.stringify({ roomCode, playerId, categorySlugs, categoryNames }),
    });
  },

  updatePlayerCategories: (
    roomCode: string,
    playerId: string,
    categorySlugs: string[],
    categoryNames: string[]
  ): Promise<{ success: boolean }> => {
    return apiRequest('/rooms/categories', {
      method: 'POST',
      body: JSON.stringify({ roomCode, playerId, categorySlugs, categoryNames }),
    });
  },

  requestRejoin: (
    roomCode: string,
    player: Player
  ): Promise<{ success: boolean; requestId: string }> => {
    return apiRequest('/rooms/rejoin/request', {
      method: 'POST',
      body: JSON.stringify({ roomCode, player }),
    });
  },

  approveRejoin: (
    requestId: string,
    roomCode: string,
    hostId: string,
    targetPlayerId: string
  ): Promise<{ success: boolean }> => {
    return apiRequest('/rooms/rejoin/approve', {
      method: 'POST',
      body: JSON.stringify({ requestId, roomCode, hostId, targetPlayerId }),
    });
  },

  denyRejoin: (
    requestId: string,
    roomCode: string,
    hostId: string,
    targetPlayerId: string
  ): Promise<{ success: boolean }> => {
    return apiRequest('/rooms/rejoin/deny', {
      method: 'POST',
      body: JSON.stringify({ requestId, roomCode, hostId, targetPlayerId }),
    });
  },

  checkRejoinStatus: (
    roomCode: string,
    playerId: string
  ): Promise<{ success: boolean; status: string; roomCode?: string }> => {
    return apiRequest(
      `/rooms/rejoin/status?roomCode=${encodeURIComponent(roomCode)}&playerId=${encodeURIComponent(playerId)}`
    );
  },
};

