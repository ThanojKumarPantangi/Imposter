import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native';
import { UserX } from 'lucide-react-native';
import { COLORS } from '../theme/colors';
import { RADIUS, SPACING } from '../theme/spacing';
import { Player } from '../types';
import { sounds } from '../utils/sound';

interface KickConfirmModalProps {
  player?: Player | null;
  onConfirm: (targetPlayerId: string) => void;
  onCancel: () => void;
}

export const KickConfirmModal: React.FC<KickConfirmModalProps> = ({
  player,
  onConfirm,
  onCancel,
}) => {
  if (!player) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <UserX size={28} color={COLORS.imposter.default} />
          </View>

          <Text style={styles.title}>Remove Player?</Text>
          <Text style={styles.message}>
            Are you sure you want to remove <Text style={styles.username}>{player.username}</Text> from this room?
          </Text>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              onPress={() => {
                sounds.playClick();
                onCancel();
              }}
              style={styles.cancelButton}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                sounds.playClick();
                onConfirm(player.id);
              }}
              style={styles.confirmButton}
            >
              <Text style={styles.confirmText}>Yes, Remove</Text>
            </TouchableOpacity>
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
    maxWidth: 360,
    backgroundColor: COLORS.dark[900],
    borderWidth: 1,
    borderColor: COLORS.slate[800],
    borderRadius: RADIUS.xxl,
    padding: SPACING.xl,
    alignItems: 'center',
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.lg,
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.white,
    marginBottom: SPACING.xs,
  },
  message: {
    fontSize: 13,
    color: COLORS.slate[400],
    textAlign: 'center',
    marginBottom: SPACING.xl,
    lineHeight: 18,
  },
  username: {
    color: COLORS.slate[100],
    fontWeight: '700',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    width: '100%',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.dark[800],
    alignItems: 'center',
  },
  cancelText: {
    color: COLORS.slate[300],
    fontWeight: '700',
    fontSize: 13,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.imposter.default,
    alignItems: 'center',
  },
  confirmText: {
    color: COLORS.white,
    fontWeight: '800',
    fontSize: 13,
  },
});

