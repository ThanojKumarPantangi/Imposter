/**
 * Device-Based Identity Management (Specification 7.2 & 7.3)
 * Generates and persists a unique UUID in localStorage across browser restarts.
 */
export function getOrCreateDeviceId() {
  const STORAGE_KEY = 'imposter_device_id';
  let deviceId = localStorage.getItem(STORAGE_KEY);
  if (!deviceId) {
    // Generate UUID v4
    deviceId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
    localStorage.setItem(STORAGE_KEY, deviceId);
  }
  return deviceId;
}

export function getCachedUsername() {
  return localStorage.getItem('imposter_username') || '';
}

export function setCachedUsername(username) {
  if (username) {
    localStorage.setItem('imposter_username', username);
  }
}

export function getCachedAvatar() {
  return localStorage.getItem('imposter_avatar') || 'avatar-1';
}

export function setCachedAvatar(avatar) {
  if (avatar) {
    localStorage.setItem('imposter_avatar', avatar);
  }
}
