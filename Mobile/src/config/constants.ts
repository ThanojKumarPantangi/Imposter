const DEFAULT_HOST = 'https://imposter.getvoroa.com';

export const CONFIG = {
  API_URL: `${DEFAULT_HOST}/api/v1`,
  SOCKET_URL: DEFAULT_HOST,
  TURN_URL: 'turn:free.expressturn.com:3478',
  TURN_USERNAME: '000000002108727276',
  TURN_CREDENTIAL: 'iGJF5TAToqJPtIk9c9NSoRa6OJU=',
};

export const STORAGE_KEYS = {
  DEVICE_ID: 'imposter_device_id',
  USERNAME: 'imposter_username',
  AVATAR: 'imposter_avatar',
  AUTH_TOKEN: 'imposter_auth_token',
  ADMIN_TOKEN: 'imposter_admin_token',
  ACTIVE_ROOM_CODE: 'imposter_active_room_code',
  CATEGORIES_CACHE: 'imposter_categories_cache',
  SERVER_URL: 'imposter_custom_server_url',
};

