import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Crown, Skull, WifiOff } from 'lucide-react-native';
import { AVATAR_GRADIENTS, COLORS } from '../theme/colors';
import { RADIUS } from '../theme/spacing';
import { Player } from '../types';

export type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

interface PlayerAvatarProps {
  player?: Player | null;
  username?: string;
  avatar?: string;
  size?: AvatarSize;
  isSpeaking?: boolean;
  showRole?: boolean;
  showStatus?: boolean;
  style?: ViewStyle;
}

export const PlayerAvatar: React.FC<PlayerAvatarProps> = ({
  player,
  username: propUsername,
  avatar: _propAvatar,
  size = 'md',
  isSpeaking = false,
  showRole = false,
  showStatus = true,
  style,
}) => {
  const username = player?.username || propUsername || 'P';
  const isHost = player?.isHost || false;
  const isConnected = player?.isConnected !== false;
  const isAlive = player?.isAlive !== false && !player?.permanentlyDeparted;
  const role = player?.role;

  const sizeDimensions = {
    sm: 36,
    md: 48,
    lg: 64,
    xl: 84,
  };

  const dim = sizeDimensions[size];
  const fontSize = dim * 0.42;

  // Derive color deterministically from username (matching web implementation)
  const nameHash = username.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const colorGrad = AVATAR_GRADIENTS[nameHash % AVATAR_GRADIENTS.length];
  const initial = username.charAt(0).toUpperCase();

  const isImposter = role === 'IMPOSTER';
  const isCivilian = role === 'CIVILIAN';

  const getBorderColor = () => {
    if (!isAlive) return COLORS.slate[700];
    if (showRole && isImposter) return COLORS.imposter.default;
    if (showRole && isCivilian) return COLORS.civilian.default;
    if (isSpeaking) return COLORS.accent.emerald;
    return COLORS.dark[700];
  };

  return (
    <View style={[styles.wrapper, { width: dim, height: dim }, style]}>
      <LinearGradient
        colors={colorGrad as any}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.circle,
          {
            width: dim,
            height: dim,
            borderRadius: dim / 2,
            borderColor: getBorderColor(),
            borderWidth: 2,
            opacity: !isAlive ? 0.6 : 1,
          },
        ]}
      >
        {!isAlive ? (
          <Skull size={dim * 0.5} color={COLORS.slate[300]} />
        ) : (
          <Text style={[styles.initial, { fontSize }]}>{initial}</Text>
        )}
      </LinearGradient>

      {/* Host Crown */}
      {isHost && (
        <View style={styles.crownBadge}>
          <Crown size={11} color="#07090e" fill="#f59e0b" />
        </View>
      )}

      {/* Status Dot */}
      {showStatus && (
        <View style={styles.statusContainer}>
          {!isConnected ? (
            <View style={[styles.statusDot, styles.disconnectedDot]}>
              <WifiOff size={8} color={COLORS.white} />
            </View>
          ) : !isAlive ? (
            <View style={[styles.statusDot, styles.eliminatedDot]} />
          ) : (
            <View style={[styles.statusDot, styles.onlineDot]} />
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    color: COLORS.white,
    fontWeight: '900',
  },
  crownBadge: {
    position: 'absolute',
    top: -4,
    right: -2,
    backgroundColor: '#f59e0b',
    borderRadius: RADIUS.round,
    padding: 3,
    borderWidth: 1.5,
    borderColor: COLORS.dark[950],
  },
  statusContainer: {
    position: 'absolute',
    bottom: -1,
    right: -1,
  },
  statusDot: {
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: COLORS.dark[950],
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineDot: {
    backgroundColor: COLORS.accent.emerald,
  },
  disconnectedDot: {
    backgroundColor: COLORS.imposter.default,
  },
  eliminatedDot: {
    backgroundColor: COLORS.slate[600],
  },
});

