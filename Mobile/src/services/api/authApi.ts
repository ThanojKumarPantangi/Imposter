import { apiRequest } from './client';
import { Player } from '../../types';

export const authApi = {
  // Device registration and session restoration
  restoreOrRegisterDevice: (
    deviceId: string,
    username?: string,
    avatar?: string
  ): Promise<{ success: boolean; player: Player; token: string }> => {
    return apiRequest('/auth/device-session', {
      method: 'POST',
      body: JSON.stringify({ deviceId, username, avatar }),
    });
  },

  // Editable username update
  updateUsername: (
    deviceId: string,
    username: string
  ): Promise<{ success: boolean; player: Player }> => {
    return apiRequest('/auth/update-username', {
      method: 'POST',
      body: JSON.stringify({ deviceId, username }),
    });
  },

  // Fetch persistent player profile
  getProfile: (deviceId: string): Promise<{ success: boolean; player: Player }> => {
    return apiRequest(`/auth/profile?deviceId=${encodeURIComponent(deviceId)}`);
  },
};

