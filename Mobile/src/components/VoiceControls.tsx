import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Mic, MicOff, Volume2, VolumeX } from 'lucide-react-native';
import { useVoiceChat } from '../context/VoiceChatContext';
import { COLORS } from '../theme/colors';
import { RADIUS, SPACING } from '../theme/spacing';
import { sounds } from '../utils/sound';

interface VoiceControlsProps {
  compact?: boolean;
}

export const VoiceControls: React.FC<VoiceControlsProps> = ({ compact = false }) => {
  const {
    micEnabled,
    micLifecycleState,
    speakerEnabled,
    toggleMicrophone,
    toggleSpeaker,
  } = useVoiceChat();

  const isMicBusy =
    micLifecycleState === 'initializing' || micLifecycleState === 'requesting_permission';

  const handleToggleMic = () => {
    if (isMicBusy) return;
    sounds.playClick();
    toggleMicrophone();
  };

  const handleToggleSpeaker = () => {
    sounds.playClick();
    toggleSpeaker();
  };

  const getMicLabel = () => {
    if (micLifecycleState === 'requesting_permission') return 'Prompting...';
    if (micLifecycleState === 'initializing') return 'Connecting...';
    if (micEnabled) return 'Mic ON';
    return 'Mic OFF';
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.controlsRow}>
        {/* Mic Button */}
        <TouchableOpacity
          onPress={handleToggleMic}
          disabled={isMicBusy}
          activeOpacity={0.7}
          style={[
            styles.button,
            micEnabled ? styles.micActive : styles.buttonInactive,
            isMicBusy && { opacity: 0.6 },
          ]}
        >
          {micEnabled ? (
            <Mic size={15} color={COLORS.accent.emerald} />
          ) : (
            <MicOff size={15} color={COLORS.slate[400]} />
          )}
          {!compact && (
            <Text style={[styles.buttonText, micEnabled && styles.micTextActive]}>
              {getMicLabel()}
            </Text>
          )}
        </TouchableOpacity>

        {/* Speaker / Deafen Button */}
        <TouchableOpacity
          onPress={handleToggleSpeaker}
          activeOpacity={0.7}
          style={[
            styles.button,
            speakerEnabled ? styles.speakerActive : styles.speakerDeafened,
          ]}
        >
          {speakerEnabled ? (
            <Volume2 size={15} color={COLORS.civilian.default} />
          ) : (
            <VolumeX size={15} color={COLORS.imposter.default} />
          )}
          {!compact && (
            <Text
              style={[
                styles.buttonText,
                speakerEnabled ? styles.speakerTextActive : styles.speakerTextDeafened,
              ]}
            >
              {speakerEnabled ? 'Audio ON' : 'Deafened'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'column',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(13, 17, 23, 0.9)',
    borderWidth: 1,
    borderColor: COLORS.slate[800],
    padding: 3,
    borderRadius: RADIUS.lg,
    gap: 4,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 5,
    borderRadius: RADIUS.md,
    gap: 4,
  },
  buttonInactive: {
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
  },
  micActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  speakerActive: {
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.35)',
  },
  speakerDeafened: {
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.35)',
  },
  buttonText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.slate[400],
  },
  micTextActive: {
    color: COLORS.accent.emerald,
  },
  speakerTextActive: {
    color: COLORS.civilian.default,
  },
  speakerTextDeafened: {
    color: COLORS.imposter.default,
  },
});
