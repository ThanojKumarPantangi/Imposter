import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { STORAGE_KEYS } from '../config/constants';
import { authApi } from '../services/api/authApi';
import { AdminUser } from '../types';

interface AuthContextType {
  adminUser: AdminUser | null;
  adminToken: string | null;
  loading: boolean;
  error: string | null;
  adminLogin: (email: string, password: string) => Promise<any>;
  adminLogout: () => Promise<void>;
  isAdminAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function initSession() {
      try {
        const storedAdminToken = await SecureStore.getItemAsync(STORAGE_KEYS.ADMIN_TOKEN).catch(() => null);
        if (storedAdminToken) {
          setAdminToken(storedAdminToken);
        }
      } catch (err: any) {
        console.warn('Session restoration failed:', err?.message);
      } finally {
        setLoading(false);
      }
    }
    initSession();
  }, []);

  const adminLogin = async (email: string, password: string): Promise<any> => {
    setError(null);
    const res = await authApi.adminLogin(email, password);
    if (res.success && res.token) {
      setAdminUser(res.admin);
      setAdminToken(res.token);
      await SecureStore.setItemAsync(STORAGE_KEYS.ADMIN_TOKEN, res.token).catch(() => {});
      return res;
    }
    throw new Error('Admin login failed');
  };

  const adminLogout = async () => {
    setAdminUser(null);
    setAdminToken(null);
    await SecureStore.deleteItemAsync(STORAGE_KEYS.ADMIN_TOKEN).catch(() => {});
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
        isAdminAuthenticated: !!adminToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

