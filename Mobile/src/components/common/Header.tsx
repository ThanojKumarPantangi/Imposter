import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Shield } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { PlayerAvatar } from '../PlayerAvatar';
import { VoiceControls } from '../VoiceControls';
import { GRADIENTS, COLORS } from '../../theme/colors';
import { RADIUS, SPACING } from '../../theme/spacing';
import { sounds } from '../../utils/sound';

interface HeaderProps {
  onOpenProfile: () => void;
  onNavigateHome?: () => void;
  showVoice?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenProfile,
  onNavigateHome,
  showVoice = false,
}) => {
  const { player } = useAuth();
  const { roomState } = useSocket();

  const handleBrandPress = () => {
    sounds.playClick();
    if (onNavigateHome) onNavigateHome();
  };

  const handleProfilePress = () => {
    sounds.playClick();
    onOpenProfile();
  };

  return (
    <View style={styles.container}>
      {/* Brand */}
      <TouchableOpacity
        onPress={handleBrandPress}
        activeOpacity={0.8}
        style={styles.brandRow}
      >
        <LinearGradient
          colors={GRADIENTS.logo as any}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.logoBorder}
        >
          <View style={styles.logoInner}>
            <Shield size={18} color={COLORS.imposter.default} />
          </View>
        </LinearGradient>

        <Text style={styles.brandTitle}>IMPOSTER</Text>
      </TouchableOpacity>

      {/* Right Controls */}
      <View style={styles.rightControls}>
        {showVoice && roomState?.code && <VoiceControls compact />}

        {player && (
          <TouchableOpacity
            onPress={handleProfilePress}
            activeOpacity={0.8}
            style={styles.profilePill}
          >
            <PlayerAvatar player={player} size="sm" showStatus={false} />
            <View style={styles.profileTextCol}>
              <Text style={styles.profileName} numberOfLines={1}>
                {player.username}
              </Text>
              <Text style={styles.profileEdit}>Edit</Text>
            </View>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    backgroundColor: 'rgba(7, 9, 14, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(30, 41, 59, 0.7)',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  logoBorder: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.md,
    padding: 1.5,
  },
  logoInner: {
    flex: 1,
    backgroundColor: COLORS.dark[950],
    borderRadius: RADIUS.md - 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#fb7185',
    letterSpacing: -0.2,
  },
  rightControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  profilePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.dark[900],
    borderWidth: 1,
    borderColor: COLORS.dark[700],
    borderRadius: RADIUS.round,
    paddingVertical: 2,
    paddingHorizontal: 3,
    paddingRight: SPACING.md,
    gap: SPACING.xs,
  },
  profileTextCol: {
    maxWidth: 90,
  },
  profileName: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.slate[200],
  },
  profileEdit: {
    fontSize: 9,
    color: COLORS.slate[500],
    fontWeight: '600',
  },
});

