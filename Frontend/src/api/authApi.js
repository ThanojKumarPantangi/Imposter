import { apiRequest } from './client';

export const authApi = {
  // Device registration and session restoration
  restoreOrRegisterDevice: (deviceId, username, avatar) => {
    return apiRequest('/auth/device-session', {
      method: 'POST',
      body: JSON.stringify({ deviceId, username, avatar })
    });
  },

  // Editable username update (Specification 7.6)
  updateUsername: (deviceId, username) => {
    return apiRequest('/auth/update-username', {
      method: 'POST',
      body: JSON.stringify({ deviceId, username })
    });
  },

  // Fetch persistent player profile
  getProfile: (deviceId) => {
    return apiRequest(`/auth/profile?deviceId=${encodeURIComponent(deviceId)}`);
  },

  // Admin Login
  adminLogin: (email, password) => {
    return apiRequest('/auth/admin/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  }
};
