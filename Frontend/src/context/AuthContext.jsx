import React, { createContext, useContext, useState, useEffect } from 'react';
import { getOrCreateDeviceId, getCachedUsername, setCachedUsername, getCachedAvatar, setCachedAvatar } from '../utils/device';
import { authApi } from '../api/authApi';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [deviceId, setDeviceId] = useState('');
  const [player, setPlayer] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('imposter_auth_token') || null);
  const [adminUser, setAdminUser] = useState(null);
  const [adminToken, setAdminToken] = useState(localStorage.getItem('imposter_admin_token') || null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Initialize device identity on application launch (Specification Section 7)
  useEffect(() => {
    async function initDeviceSession() {
      try {
        const id = getOrCreateDeviceId();
        setDeviceId(id);
        const cachedName = getCachedUsername();
        const cachedAv = getCachedAvatar();

        const res = await authApi.restoreOrRegisterDevice(id, cachedName, cachedAv);
        if (res.success && res.player) {
          setPlayer(res.player);
          setToken(res.token);
          localStorage.setItem('imposter_auth_token', res.token);
          setCachedUsername(res.player.username);
          setCachedAvatar(res.player.avatar);
        }
      } catch (err) {
        console.warn('Backend unavailable during session restoration, using offline fallback identity:', err.message);
        // Resilient fallback (Specification 7.3: Preserve local data & show recoverable state)
        const id = getOrCreateDeviceId();
        setDeviceId(id);
        const cachedName = getCachedUsername() || `Player_${Math.floor(1000 + Math.random() * 9000)}`;
        const cachedAv = getCachedAvatar() || 'avatar-1';
        setPlayer({
          id: id,
          deviceId: id,
          username: cachedName,
          avatar: cachedAv,
          stats: { gamesPlayed: 0, wins: 0 }
        });
      } finally {
        setLoading(false);
      }
    }

    initDeviceSession();
  }, []);

  // Update Username (Specification 7.6: Editable Username)
  const updateUsername = async (newUsername) => {
    try {
      setError(null);
      const res = await authApi.updateUsername(deviceId, newUsername);
      if (res.success && res.player) {
        setPlayer(res.player);
        setCachedUsername(res.player.username);
        return { success: true };
      }
    } catch (err) {
      setError(err.message);
      // Fallback local update if offline
      setPlayer(prev => ({ ...prev, username: newUsername }));
      setCachedUsername(newUsername);
      return { success: true };
    }
  };

  // Change Avatar
  const updateAvatar = (newAvatar) => {
    setPlayer(prev => ({ ...prev, avatar: newAvatar }));
    setCachedAvatar(newAvatar);
  };

  // Admin login
  const adminLogin = async (email, password) => {
    setError(null);
    const res = await authApi.adminLogin(email, password);
    if (res.success && res.token) {
      setAdminUser(res.admin);
      setAdminToken(res.token);
      localStorage.setItem('imposter_admin_token', res.token);
      return res;
    }
    throw new Error('Admin login failed');
  };

  const adminLogout = () => {
    setAdminUser(null);
    setAdminToken(null);
    localStorage.removeItem('imposter_admin_token');
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
