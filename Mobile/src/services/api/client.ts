import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { CONFIG, STORAGE_KEYS } from '../../config/constants';

export async function getApiBaseUrl(): Promise<string> {
  try {
    const custom = await AsyncStorage.getItem(STORAGE_KEYS.SERVER_URL);
    if (custom && custom.trim()) {
      const clean = custom.trim().replace(/\/+$/, '');
      return clean.endsWith('/api/v1') ? clean : `${clean}/api/v1`;
    }
  } catch {
    // fallback
  }
  return CONFIG.API_URL;
}

export async function getAuthToken(): Promise<string | null> {
  try {
    const secureToken = await SecureStore.getItemAsync(STORAGE_KEYS.ADMIN_TOKEN);
    if (secureToken) return secureToken;
    const authT = await SecureStore.getItemAsync(STORAGE_KEYS.AUTH_TOKEN);
    if (authT) return authT;
    return await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
  } catch {
    return null;
  }
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const [baseUrl, token] = await Promise.all([getApiBaseUrl(), getAuthToken()]);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((options.headers as Record<string, string>) || {}),
  };

  const url = `${baseUrl}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({
    success: false,
    error: 'Network error or invalid JSON response',
  }));

  if (!response.ok) {
    const error: any = new Error(
      data.error || `Request failed with status ${response.status}`
    );
    error.status = response.status;
    error.data = data;
    error.requiresApproval = data.requiresApproval;
    error.kicked = data.kicked;
    throw error;
  }

  return data as T;
}

