import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { X, Check, User } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { GradientButton } from './common/GradientButton';
import { COLORS } from '../theme/colors';
import { RADIUS, SPACING } from '../theme/spacing';
import { sounds } from '../utils/sound';

const AVATARS = [
  'avatar-1',
  'avatar-2',
  'avatar-3',
  'avatar-4',
  'avatar-5',
  'avatar-6',
  'avatar-7',
  'avatar-8',
];

interface EditUsernameModalProps {
  visible: boolean;
  onClose: () => void;
}

export const EditUsernameModal: React.FC<EditUsernameModalProps> = ({
  visible,
  onClose,
}) => {
  const { player, updateUsername, updateAvatar } = useAuth();
  const { roomState, updateLobbyUsername } = useSocket();

  const [username, setUsername] = useState<string>(player?.username || '');
  const [selectedAvatar, setSelectedAvatar] = useState<string>(player?.avatar || 'avatar-1');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (visible) {
      setUsername(player?.username || '');
      setSelectedAvatar(player?.avatar || 'avatar-1');
      setError('');
    }
  }, [visible, player?.username, player?.avatar]);

  const handleSave = async () => {
    if (!username.trim() || username.trim().length < 2) {
      setError('Username must be at least 2 characters');
      return;
    }

    try {
      setLoading(true);
      setError('');
      sounds.playClick();
      await updateUsername(username.trim());
      updateAvatar(selectedAvatar);

      if (roomState?.code && player?.id) {
        updateLobbyUsername(roomState.code, player.id, username.trim());
      }

      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X size={20} color={COLORS.slate[400]} />
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.avatarIconBox}>
              <User size={22} color={COLORS.white} />
            </View>
            <View>
              <Text style={styles.title}>Edit Your Profile</Text>
              <Text style={styles.subtitle}>Change your display name and game avatar</Text>
            </View>
          </View>

          {error ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Display Username Field */}
          <View style={styles.fieldSection}>
            <Text style={styles.fieldLabel}>Display Username</Text>
            <TextInput
              value={username}
              onChangeText={setUsername}
              maxLength={25}
              placeholder="Enter your name..."
              placeholderTextColor={COLORS.slate[500]}
              style={styles.textInput}
              autoCapitalize="words"
            />
            <Text style={styles.fieldHint}>
              Max 25 characters. Preserves your device game records.
            </Text>
          </View>

          {/* Select Avatar Grid */}
          <View style={styles.fieldSection}>
            <Text style={styles.fieldLabel}>Select Avatar</Text>
            <View style={styles.avatarGrid}>
              {AVATARS.map((av, idx) => {
                const isSelected = selectedAvatar === av;
                return (
                  <TouchableOpacity
                    key={av}
                    onPress={() => {
                      sounds.playClick();
                      setSelectedAvatar(av);
                    }}
                    style={[
                      styles.avatarChip,
                      isSelected ? styles.avatarChipSelected : styles.avatarChipUnselected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.avatarChipText,
                        isSelected && styles.avatarChipTextSelected,
                      ]}
                    >
                      P{idx + 1}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionsRow}>
            <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>

            <GradientButton
              title={loading ? 'Saving...' : 'Save Profile'}
              onPress={handleSave}
              variant="cyan"
              loading={loading}
              icon={<Check size={16} color={COLORS.white} />}
              iconPosition="left"
              size="sm"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(7, 9, 14, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: COLORS.dark[900],
    borderWidth: 1,
    borderColor: COLORS.slate[800],
    borderRadius: RADIUS.xxl,
    padding: SPACING.xl,
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: SPACING.lg,
    right: SPACING.lg,
    zIndex: 10,
    padding: 6,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.dark[800],
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  avatarIconBox: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.civilian.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.white,
  },
  subtitle: {
    fontSize: 11,
    color: COLORS.slate[400],
    marginTop: 2,
  },
  errorBanner: {
    backgroundColor: 'rgba(244, 63, 94, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.3)',
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
  },
  errorText: {
    fontSize: 11,
    color: COLORS.imposter.default,
    fontWeight: '700',
    textAlign: 'center',
  },
  fieldSection: {
    marginBottom: SPACING.lg,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    color: COLORS.slate[400],
    letterSpacing: 0.5,
    marginBottom: SPACING.sm,
  },
  textInput: {
    backgroundColor: COLORS.dark[950],
    borderWidth: 1,
    borderColor: COLORS.slate[700],
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600',
  },
  fieldHint: {
    fontSize: 10,
    color: COLORS.slate[500],
    marginTop: 4,
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  avatarChip: {
    width: '22%',
    height: 40,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarChipUnselected: {
    backgroundColor: COLORS.dark[800],
  },
  avatarChipSelected: {
    backgroundColor: COLORS.civilian.default,
    borderWidth: 1.5,
    borderColor: '#38bdf8',
  },
  avatarChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.slate[400],
  },
  avatarChipTextSelected: {
    color: COLORS.white,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: SPACING.md,
    marginTop: SPACING.sm,
  },
  cancelBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  cancelText: {
    color: COLORS.slate[400],
    fontWeight: '600',
    fontSize: 13,
  },
});

