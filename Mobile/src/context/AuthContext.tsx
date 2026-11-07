import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import {
  getOrCreateDeviceId,
  getCachedUsername,
  setCachedUsername,
  getCachedAvatar,
  setCachedAvatar,
} from '../utils/device';
import { authApi } from '../services/api/authApi';
import { Player, AdminUser } from '../types';
import { STORAGE_KEYS } from '../config/constants';

interface AuthContextType {
  deviceId: string;
  player: Player | null;
  token: string | null;
  adminUser: AdminUser | null;
  adminToken: string | null;
  loading: boolean;
  error: string | null;
  updateUsername: (newUsername: string) => Promise<{ success: boolean }>;
  updateAvatar: (newAvatar: string) => void;
  adminLogin: (email: string, password: string) => Promise<any>;
  adminLogout: () => void;
  isAdminAuthenticated: boolean;
  refreshAuthSession: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [deviceId, setDeviceId] = useState<string>('');
  const [player, setPlayer] = useState<Player | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function initDeviceSession() {
      try {
        const id = await getOrCreateDeviceId();
        setDeviceId(id);
        const cachedName = await getCachedUsername();
        const cachedAv = await getCachedAvatar();

        const storedAdminToken = await SecureStore.getItemAsync(STORAGE_KEYS.ADMIN_TOKEN).catch(() => null);
        if (storedAdminToken) {
          setAdminToken(storedAdminToken);
        }

        const storedAuthToken = await SecureStore.getItemAsync(STORAGE_KEYS.AUTH_TOKEN).catch(() => null);
        if (storedAuthToken) {
          setToken(storedAuthToken);
        }

        const res = await authApi.restoreOrRegisterDevice(id, cachedName, cachedAv);
        if (res.success && res.player) {
          setPlayer(res.player);
          setToken(res.token);
          await SecureStore.setItemAsync(STORAGE_KEYS.AUTH_TOKEN, res.token).catch(() => {});
          await setCachedUsername(res.player.username);
          await setCachedAvatar(res.player.avatar);
        }
      } catch (err: any) {
        console.warn('Backend unavailable during session restoration, using offline fallback identity:', err.message);
        const id = await getOrCreateDeviceId();
        setDeviceId(id);
        const cachedName = (await getCachedUsername()) || `Player_${Math.floor(1000 + Math.random() * 9000)}`;
        const cachedAv = (await getCachedAvatar()) || 'avatar-1';
        setPlayer({
          id,
          deviceId: id,
          username: cachedName,
          avatar: cachedAv,
          stats: { gamesPlayed: 0, wins: 0 },
        });
      } finally {
        setLoading(false);
      }
    }

    initDeviceSession();
  }, []);

  const updateUsername = async (newUsername: string): Promise<{ success: boolean }> => {
    try {
      setError(null);
      const res = await authApi.updateUsername(deviceId, newUsername);
      if (res.success && res.player) {
        setPlayer(res.player);
        await setCachedUsername(res.player.username);
        return { success: true };
      }
      return { success: false };
    } catch (err: any) {
      setError(err.message);
      setPlayer((prev) => (prev ? { ...prev, username: newUsername } : null));
      await setCachedUsername(newUsername);
      return { success: true };
    }
  };

  const updateAvatar = async (newAvatar: string) => {
    setPlayer((prev) => (prev ? { ...prev, avatar: newAvatar } : null));
    await setCachedAvatar(newAvatar);
  };

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

  const refreshAuthSession = async (): Promise<string | null> => {
    try {
      const id = deviceId || (await getOrCreateDeviceId());
      const cachedName = await getCachedUsername();
      const cachedAv = await getCachedAvatar();
      const res = await authApi.restoreOrRegisterDevice(id, cachedName, cachedAv);
      if (res.success && res.player) {
        setPlayer(res.player);
        setToken(res.token);
        await SecureStore.setItemAsync(STORAGE_KEYS.AUTH_TOKEN, res.token).catch(() => {});
        return res.token;
      }
    } catch (e: any) {
      console.warn('Could not refresh auth session:', e.message);
    }
    return token;
  };

  return (
    <AuthContext.Provider
      value={{
        deviceId,
        player,
        token,
        adminUser,
        adminToken,
        loading,
        error,
        updateUsername,
        updateAvatar,
        adminLogin,
        adminLogout,
        isAdminAuthenticated: !!adminToken,
        refreshAuthSession,
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

export default AuthContext;

