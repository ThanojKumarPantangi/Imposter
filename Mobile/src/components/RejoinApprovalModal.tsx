import React, { useEffect, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native';
import { UserCheck, UserX, Clock, AlertCircle } from 'lucide-react-native';
import { PlayerAvatar } from './PlayerAvatar';
import { COLORS } from '../theme/colors';
import { RADIUS, SPACING } from '../theme/spacing';
import { RejoinRequest } from '../types';
import { sounds } from '../utils/sound';

interface RejoinApprovalModalProps {
  request?: RejoinRequest | null;
  onApprove: () => void;
  onDeny: () => void;
}

export const RejoinApprovalModal: React.FC<RejoinApprovalModalProps> = ({
  request,
  onApprove,
  onDeny,
}) => {
  const [timeLeft, setTimeLeft] = useState<number>(45);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onDeny();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onDeny]);

  if (!request) return null;

  const player = request.player || {};

  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* Accent Line */}
          <View style={styles.accentBar} />

          <View style={styles.headerRow}>
            <View style={styles.alertTag}>
              <AlertCircle size={14} color="#f43f5e" />
              <Text style={styles.alertTagText}>Rejoin Request</Text>
            </View>

            <View style={styles.timerBadge}>
              <Clock size={12} color="#06b6d4" />
              <Text style={styles.timerText}>{timeLeft}s</Text>
            </View>
          </View>

          <Text style={styles.title}>Player wants to rejoin</Text>

          <View style={styles.playerBox}>
            <PlayerAvatar username={player.username} avatar={player.avatar} size="md" />
            <View style={styles.playerInfo}>
              <Text style={styles.playerName}>{player.username || 'Player'}</Text>
              <Text style={styles.playerSub}>Wants to join your room again.</Text>
            </View>
          </View>

          <Text style={styles.explanation}>
            This player was previously removed from the room. As host, you can choose whether to allow them back into the lobby.
          </Text>

          <View style={styles.actionsRow}>
            <TouchableOpacity
              onPress={() => {
                sounds.playClick();
                onDeny();
              }}
              style={styles.denyButton}
            >
              <UserX size={16} color="#fb7185" />
              <Text style={styles.denyText}>Deny</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                sounds.playClick();
                onApprove();
              }}
              style={styles.allowButton}
            >
              <UserCheck size={16} color={COLORS.white} />
              <Text style={styles.allowText}>Allow</Text>
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
    maxWidth: 400,
    backgroundColor: COLORS.dark[900],
    borderWidth: 1,
    borderColor: COLORS.slate[700],
    borderRadius: RADIUS.xxl,
    padding: SPACING.xl,
    overflow: 'hidden',
  },
  accentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: COLORS.civilian.default,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  alertTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  alertTagText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.imposter.default,
    textTransform: 'uppercase',
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.dark[800],
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.round,
    gap: 4,
  },
  timerText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.slate[300],
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.white,
    marginBottom: SPACING.sm,
  },
  playerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.dark[950],
    borderWidth: 1,
    borderColor: COLORS.slate[800],
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginVertical: SPACING.md,
    gap: SPACING.md,
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.white,
  },
  playerSub: {
    fontSize: 11,
    color: COLORS.slate[400],
    marginTop: 2,
  },
  explanation: {
    fontSize: 12,
    color: COLORS.slate[400],
    lineHeight: 18,
    marginBottom: SPACING.xl,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  denyButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    backgroundColor: 'rgba(244, 63, 94, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.3)',
    gap: 6,
  },
  denyText: {
    color: '#fb7185',
    fontWeight: '800',
    fontSize: 14,
  },
  allowButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.accent.emerald,
    gap: 6,
  },
  allowText: {
    color: COLORS.white,
    fontWeight: '800',
    fontSize: 14,
  },
});

