import { apiRequest } from './client';

export const authApi = {
  adminLogin: (email: string, password: string) => {
    return apiRequest('/auth/admin/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },
};

