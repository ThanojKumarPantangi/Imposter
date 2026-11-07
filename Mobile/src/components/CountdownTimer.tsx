import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Clock } from 'lucide-react-native';
import { serverTimeSync } from '../utils/serverTimeSync';
import { COLORS } from '../theme/colors';
import { RADIUS, SPACING } from '../theme/spacing';

interface CountdownTimerProps {
  deadline?: number | null;
  totalSeconds?: number;
  onExpire?: () => void;
  label?: string;
}

export const CountdownTimer: React.FC<CountdownTimerProps> = ({
  deadline,
  totalSeconds = 30,
  onExpire,
  label,
}) => {
  const onExpireRef = useRef(onExpire);
  const hasExpiredRef = useRef(false);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  const [timeLeft, setTimeLeft] = useState<number>(() => {
    if (!deadline) return 0;
    return serverTimeSync.getRemainingSeconds(deadline);
  });

  useEffect(() => {
    hasExpiredRef.current = false;
    if (!deadline) {
      setTimeLeft(0);
      return;
    }

    const calc = () => serverTimeSync.getRemainingSeconds(deadline);
    const initialRem = calc();
    setTimeLeft(initialRem);

    if (initialRem <= 0) {
      hasExpiredRef.current = true;
      if (onExpireRef.current) onExpireRef.current();
      return;
    }

    const interval = setInterval(() => {
      const remaining = calc();
      setTimeLeft(remaining);
      if (remaining <= 0 && !hasExpiredRef.current) {
        hasExpiredRef.current = true;
        if (onExpireRef.current) onExpireRef.current();
      }
    }, 250);

    const unsubscribe = serverTimeSync.subscribe(() => {
      setTimeLeft(calc());
    });

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, [deadline]);

  if (!deadline) {
    return (
      <View style={styles.container}>
        <View style={styles.iconBox}>
          <Clock size={16} color={COLORS.slate[400]} />
        </View>
        <View style={styles.textColumn}>
          {label && <Text style={styles.labelText}>{label}</Text>}
          <Text style={styles.syncingText}>Syncing...</Text>
        </View>
      </View>
    );
  }

  const effectiveTotal = Math.max(1, totalSeconds || timeLeft || 1);
  const percentage = Math.min(100, Math.max(0, (timeLeft / effectiveTotal) * 100));
  const isUrgent = timeLeft <= 5 && timeLeft > 0;

  return (
    <View style={styles.container}>
      <View style={[styles.iconBox, isUrgent && styles.iconBoxUrgent]}>
        <Clock size={16} color={isUrgent ? COLORS.imposter.default : COLORS.slate[300]} />
      </View>

      <View style={styles.textColumn}>
        {label && <Text style={styles.labelText}>{label}</Text>}
        <Text style={[styles.timeText, isUrgent && styles.timeTextUrgent]}>
          {timeLeft}s
        </Text>
      </View>

      {/* Mini Progress Bar */}
      <View style={styles.progressBarTrack}>
        <View
          style={[
            styles.progressBarFill,
            { width: `${percentage}%` },
            isUrgent && styles.progressBarUrgent,
          ]}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(13, 17, 23, 0.92)',
    borderWidth: 1,
    borderColor: COLORS.slate[800],
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.lg,
  },
  iconBox: {
    padding: 6,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.dark[800],
    marginRight: SPACING.sm,
  },
  iconBoxUrgent: {
    backgroundColor: 'rgba(244, 63, 94, 0.2)',
  },
  textColumn: {
    minWidth: 50,
  },
  labelText: {
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    color: COLORS.slate[400],
    letterSpacing: 0.5,
  },
  syncingText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.slate[500],
  },
  timeText: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.slate[100],
  },
  timeTextUrgent: {
    color: COLORS.imposter.default,
  },
  progressBarTrack: {
    width: 44,
    height: 5,
    backgroundColor: COLORS.slate[800],
    borderRadius: RADIUS.round,
    overflow: 'hidden',
    marginLeft: SPACING.sm,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.civilian.default,
    borderRadius: RADIUS.round,
  },
  progressBarUrgent: {
    backgroundColor: COLORS.imposter.default,
  },
});

