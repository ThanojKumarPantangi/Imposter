import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { STORAGE_KEYS } from '../config/constants';

let inMemoryDeviceId: string | null = null;
let inMemoryUsername: string | null = null;
let inMemoryAvatar: string | null = null;

export async function getOrCreateDeviceId(): Promise<string> {
  if (inMemoryDeviceId) return inMemoryDeviceId;

  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEYS.DEVICE_ID);
    if (saved) {
      inMemoryDeviceId = saved;
      return saved;
    }

    const newId = Crypto.randomUUID();
    await AsyncStorage.setItem(STORAGE_KEYS.DEVICE_ID, newId);
    inMemoryDeviceId = newId;
    return newId;
  } catch (err) {
    // Fallback uuid
    const fallbackId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
    inMemoryDeviceId = fallbackId;
    return fallbackId;
  }
}

export async function getCachedUsername(): Promise<string> {
  if (inMemoryUsername) return inMemoryUsername;
  try {
    const name = await AsyncStorage.getItem(STORAGE_KEYS.USERNAME);
    inMemoryUsername = name || '';
    return inMemoryUsername;
  } catch {
    return '';
  }
}

export async function setCachedUsername(username: string): Promise<void> {
  inMemoryUsername = username;
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.USERNAME, username);
  } catch (e) {
    console.warn('Failed to cache username:', e);
  }
}

export async function getCachedAvatar(): Promise<string> {
  if (inMemoryAvatar) return inMemoryAvatar;
  try {
    const av = await AsyncStorage.getItem(STORAGE_KEYS.AVATAR);
    inMemoryAvatar = av || 'avatar-1';
    return inMemoryAvatar;
  } catch {
    return 'avatar-1';
  }
}

export async function setCachedAvatar(avatar: string): Promise<void> {
  inMemoryAvatar = avatar;
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.AVATAR, avatar);
  } catch (e) {
    console.warn('Failed to cache avatar:', e);
  }
}

export async function getCustomServerUrl(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(STORAGE_KEYS.SERVER_URL);
  } catch {
    return null;
  }
}

export async function setCustomServerUrl(url: string | null): Promise<void> {
  try {
    if (url) {
      await AsyncStorage.setItem(STORAGE_KEYS.SERVER_URL, url);
    } else {
      await AsyncStorage.removeItem(STORAGE_KEYS.SERVER_URL);
    }
  } catch (e) {
    console.warn('Failed to save server URL:', e);
  }
}

