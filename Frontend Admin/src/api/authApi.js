import { apiRequest } from './client';

export const authApi = {
  // Admin Login
  adminLogin: (email, password) => {
    return apiRequest('/auth/admin/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  }
};

