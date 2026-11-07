import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { WifiOff } from 'lucide-react-native';
import { serverTimeSync } from '../utils/serverTimeSync';
import { COLORS } from '../theme/colors';
import { RADIUS, SPACING } from '../theme/spacing';
import { DisconnectAlert } from '../types';

interface DisconnectedBannerProps {
  alertData?: DisconnectAlert | null;
}

export const DisconnectedBanner: React.FC<DisconnectedBannerProps> = ({ alertData }) => {
  if (!alertData) return null;

  const { username, deadline, timeoutSeconds } = alertData;
  const [secondsRemaining, setSecondsRemaining] = useState<number>(() => {
    if (deadline) return serverTimeSync.getRemainingSeconds(deadline);
    return timeoutSeconds || 5;
  });

  useEffect(() => {
    function tick() {
      if (deadline) {
        setSecondsRemaining(serverTimeSync.getRemainingSeconds(deadline));
      }
    }

    tick();
    const interval = setInterval(tick, 500);
    const unsubscribe = serverTimeSync.subscribe(tick);
    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, [deadline]);

  return (
    <View style={styles.banner}>
      <View style={styles.contentRow}>
        <View style={styles.iconBox}>
          <WifiOff size={18} color="#fb7185" />
        </View>

        <View style={styles.textContainer}>
          <Text style={styles.titleText}>
            Player <Text style={styles.usernameText}>{username}</Text> Disconnected
          </Text>
          <Text style={styles.subtitleText}>
            Game start is locked until all players reconnect.
          </Text>
        </View>

        <View style={styles.timeoutBadge}>
          <Text style={styles.timeoutLabel}>Timeout In:</Text>
          <Text style={styles.timeoutSeconds}>{secondsRemaining}s</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    backgroundColor: 'rgba(56, 10, 20, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.4)',
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconBox: {
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    backgroundColor: 'rgba(244, 63, 94, 0.2)',
    marginRight: SPACING.sm,
  },
  textContainer: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  titleText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fecdd3',
  },
  usernameText: {
    color: COLORS.white,
    textDecorationLine: 'underline',
  },
  subtitleText: {
    fontSize: 10,
    color: 'rgba(254, 205, 211, 0.75)',
    marginTop: 2,
  },
  timeoutBadge: {
    backgroundColor: 'rgba(13, 17, 23, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(244, 63, 94, 0.3)',
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    alignItems: 'center',
  },
  timeoutLabel: {
    fontSize: 9,
    color: COLORS.slate[400],
    fontWeight: '600',
  },
  timeoutSeconds: {
    fontSize: 15,
    fontWeight: '900',
    color: COLORS.imposter.default,
  },
});

