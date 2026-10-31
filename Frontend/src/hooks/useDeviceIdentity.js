import { useAuth } from '../context/AuthContext';

export function useDeviceIdentity() {
  const { deviceId, player, updateUsername } = useAuth();
  return {
    deviceId,
    player,
    username: player?.username || '',
    avatar: player?.avatar || 'avatar-1',
    stats: player?.stats || {},
    updateUsername
  };
}
