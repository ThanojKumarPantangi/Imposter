import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../api/authApi';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [adminUser, setAdminUser] = useState(null);
  const [adminToken, setAdminToken] = useState(localStorage.getItem('imposter_admin_token') || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const adminLogin = async (email, password) => {
    setError(null);
    setLoading(true);
    try {
      const res = await authApi.adminLogin(email, password);
      if (res.success && res.token) {
        setAdminUser(res.admin);
        setAdminToken(res.token);
        localStorage.setItem('imposter_admin_token', res.token);
        return res;
      }
      throw new Error('Admin login failed');
    } finally {
      setLoading(false);
    }
  };

  const adminLogout = () => {
    setAdminUser(null);
    setAdminToken(null);
    localStorage.removeItem('imposter_admin_token');
  };

  return (
    <AuthContext.Provider
      value={{
        adminUser,
        adminToken,
        loading,
        error,
        adminLogin,
        adminLogout,
        isAdminAuthenticated: !!adminToken
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

