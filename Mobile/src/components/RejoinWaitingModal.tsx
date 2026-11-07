import React, { useEffect, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Clock, ShieldAlert, ArrowLeft, CheckCircle2, XCircle } from 'lucide-react-native';
import { COLORS } from '../theme/colors';
import { RADIUS, SPACING } from '../theme/spacing';
import { RejoinState } from '../types';
import { sounds } from '../utils/sound';

interface RejoinWaitingModalProps {
  rejoinState?: RejoinState | null;
  onCancel: () => void;
  onReturnHome: () => void;
}

export const RejoinWaitingModal: React.FC<RejoinWaitingModalProps> = ({
  rejoinState,
  onCancel,
  onReturnHome,
}) => {
  const [timeLeft, setTimeLeft] = useState<number>(rejoinState?.expiresInSeconds || 45);

  useEffect(() => {
    if (rejoinState?.status !== 'PENDING') return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [rejoinState?.status]);

  if (!rejoinState) return null;

  const isPending = rejoinState.status === 'PENDING' && timeLeft > 0;
  const isApproved = rejoinState.status === 'APPROVED';
  const isDenied = rejoinState.status === 'DENIED';
  const isExpired = (rejoinState.status === 'PENDING' && timeLeft === 0) || rejoinState.status === 'TIMEOUT';
  const isError = rejoinState.status === 'ERROR';

  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.accentBar} />

          {/* Status Icon */}
          <View style={styles.iconCircle}>
            {isPending && <ActivityIndicator size="large" color={COLORS.civilian.default} />}
            {isApproved && <CheckCircle2 size={36} color={COLORS.accent.emerald} />}
            {isDenied && <XCircle size={36} color={COLORS.imposter.default} />}
            {(isExpired || isError) && <ShieldAlert size={36} color={COLORS.accent.amber} />}
          </View>

          {/* Header */}
          <Text style={styles.title}>
            {isPending && 'Waiting for Host Approval'}
            {isApproved && 'Request Approved!'}
            {isDenied && 'Request Declined'}
            {isExpired && 'Request Expired'}
            {isError && 'Rejoin Error'}
          </Text>

          {/* Message */}
          <Text style={styles.message}>
            {isPending && (
              <>
                You previously left or were removed from room{' '}
                <Text style={styles.roomCode}>{rejoinState.roomCode}</Text>. Waiting for the host to allow or deny your request.
              </>
            )}
            {isApproved && 'The host accepted your request. Entering the lobby now...'}
            {isDenied && (rejoinState.message || 'The host declined your request to join this room.')}
            {isExpired && 'The host did not respond before the request timed out. You cannot join this room at this time.'}
            {isError && (rejoinState.message || 'Could not send rejoin request.')}
          </Text>

          {isPending && (
            <View style={styles.timerBadge}>
              <Clock size={12} color={COLORS.civilian.default} />
              <Text style={styles.timerText}>Time remaining: {timeLeft}s</Text>
            </View>
          )}

          {/* Actions */}
          <View style={styles.actionsContainer}>
            {isPending && (
              <TouchableOpacity
                onPress={() => {
                  sounds.playClick();
                  onCancel();
                }}
                style={styles.cancelBtn}
              >
                <Text style={styles.cancelText}>Cancel Request</Text>
              </TouchableOpacity>
            )}

            {!isPending && !isApproved && (
              <TouchableOpacity
                onPress={() => {
                  sounds.playClick();
                  onReturnHome();
                }}
                style={styles.returnHomeBtn}
              >
                <ArrowLeft size={16} color={COLORS.white} />
                <Text style={styles.returnHomeText}>Return Home</Text>
              </TouchableOpacity>
            )}
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
    maxWidth: 380,
    backgroundColor: COLORS.dark[900],
    borderWidth: 1,
    borderColor: COLORS.slate[700],
    borderRadius: RADIUS.xxl,
    padding: SPACING.xl,
    alignItems: 'center',
    overflow: 'hidden',
  },
  accentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: COLORS.imposter.default,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.dark[800],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.white,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  message: {
    fontSize: 13,
    color: COLORS.slate[300],
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: SPACING.lg,
  },
  roomCode: {
    fontFamily: 'monospace',
    fontWeight: '800',
    color: COLORS.civilian.default,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.dark[800],
    paddingHorizontal: SPACING.md,
    paddingVertical: 5,
    borderRadius: RADIUS.round,
    gap: 6,
    marginBottom: SPACING.lg,
  },
  timerText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.slate[300],
  },
  actionsContainer: {
    width: '100%',
  },
  cancelBtn: {
    width: '100%',
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
  returnHomeBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.imposter.default,
    gap: 6,
  },
  returnHomeText: {
    color: COLORS.white,
    fontWeight: '800',
    fontSize: 13,
  },
});

