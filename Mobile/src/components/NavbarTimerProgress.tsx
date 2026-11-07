import React, { useEffect, useRef, useState, useCallback, memo } from 'react';
import {
  View,
  Animated,
  Easing,
  StyleSheet,
  Dimensions,
  LayoutChangeEvent,
  AppState,
  AppStateStatus,
} from 'react-native';
import { serverTimeSync } from '../utils/serverTimeSync';

export interface NavbarTimerProgressProps {
  deadline?: number | null;
  totalDurationSeconds?: number;
  height?: number;
  trackColor?: string;
  fillColor?: string;
  whiteColor?: string;
  yellowColor?: string;
  redColor?: string;
  onExpire?: () => void;
}

export const NavbarTimerProgress: React.FC<NavbarTimerProgressProps> = memo(({
  deadline,
  totalDurationSeconds = 30,
  height = 2.5,
  trackColor = 'rgba(255, 255, 255, 0.12)',
  fillColor,
  whiteColor = '#FFFFFF',
  yellowColor = '#FACC15',
  redColor = '#EF4444',
  onExpire,
}) => {
  const progressAnim = useRef(new Animated.Value(0)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);
  const onExpireRef = useRef(onExpire);
  const hasExpiredRef = useRef(false);
  const animStartTimeRef = useRef<number>(0);
  const animStartProgressRef = useRef<number>(0);

  // Measure navbar width for native transform translation
  const [layoutWidth, setLayoutWidth] = useState<number>(() => Dimensions.get('window').width);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width;
    if (width > 0 && Math.abs(width - layoutWidth) > 1) {
      setLayoutWidth(width);
    }
  }, [layoutWidth]);

  // Synchronize and run linear countdown animation
  const startAnimation = useCallback(
    (targetDeadline: number, durationSeconds: number) => {
      if (animRef.current) {
        animRef.current.stop();
        animRef.current = null;
      }

      const totalMs = Math.max(1, durationSeconds || 30) * 1000;
      const estimatedServerNow = serverTimeSync.getEstimatedServerTime();
      const remainingMs = Math.max(0, targetDeadline - estimatedServerNow);

      if (remainingMs <= 0) {
        progressAnim.setValue(0);
        if (!hasExpiredRef.current) {
          hasExpiredRef.current = true;
          if (onExpireRef.current) onExpireRef.current();
        }
        return;
      }

      hasExpiredRef.current = false;
      const currentProgress = Math.min(1, Math.max(0, remainingMs / totalMs));
      progressAnim.setValue(currentProgress);
      animStartTimeRef.current = Date.now();
      animStartProgressRef.current = currentProgress;

      const animation = Animated.timing(progressAnim, {
        toValue: 0,
        duration: remainingMs,
        easing: Easing.linear,
        useNativeDriver: true,
      });

      animRef.current = animation;
      animation.start(({ finished }) => {
        if (finished) {
          animRef.current = null;
          if (!hasExpiredRef.current) {
            hasExpiredRef.current = true;
            if (onExpireRef.current) onExpireRef.current();
          }
        }
      });
    },
    [progressAnim]
  );

  // Main lifecycle: starts or resets animation whenever deadline or configured duration changes
  useEffect(() => {
    if (!deadline) {
      if (animRef.current) {
        animRef.current.stop();
        animRef.current = null;
      }
      progressAnim.setValue(0);
      hasExpiredRef.current = false;
      return;
    }

    startAnimation(deadline, totalDurationSeconds);

    return () => {
      if (animRef.current) {
        animRef.current.stop();
        animRef.current = null;
      }
    };
  }, [deadline, totalDurationSeconds, startAnimation]);

  // Re-synchronize when returning from background
  useEffect(() => {
    if (!deadline) return;

    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active' && deadline) {
        startAnimation(deadline, totalDurationSeconds);
      }
    });

    return () => subscription.remove();
  }, [deadline, totalDurationSeconds, startAnimation]);

  // Gentle clock resync when authoritative server offset is updated
  useEffect(() => {
    if (!deadline) return;

    const unsubscribe = serverTimeSync.subscribe((serverNow) => {
      if (!deadline) return;
      const remainingMs = Math.max(0, deadline - serverNow);
      const totalMs = Math.max(1, totalDurationSeconds || 30) * 1000;
      const targetProgress = Math.min(1, Math.max(0, remainingMs / totalMs));

      const elapsed = Date.now() - animStartTimeRef.current;
      const currentExpectedProgress = Math.max(0, animStartProgressRef.current - (elapsed / totalMs));

      if (Math.abs(currentExpectedProgress - targetProgress) > 0.05) {
        startAnimation(deadline, totalDurationSeconds);
      }
    });

    return () => unsubscribe();
  }, [deadline, totalDurationSeconds, startAnimation]);

  // If there is no active deadline, do not display a stale progress bar
  if (!deadline) {
    return null;
  }

  // Native transform: scales from full width down to 0, anchored at the left edge
  const scaleX = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.0001, 1],
    extrapolate: 'clamp',
  });

  const translateX = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-layoutWidth / 2, 0],
    extrapolate: 'clamp',
  });

  // Dynamic color transitions:
  // Starts white at 100%, turns yellow at 50%, turns red at 20%
  const whiteOpacity = progressAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0, 1],
    extrapolate: 'clamp',
  });

  const yellowOpacity = progressAnim.interpolate({
    inputRange: [0, 0.2, 0.5, 1],
    outputRange: [0, 0, 1, 1],
    extrapolate: 'clamp',
  });

  return (
    <View
      style={[styles.track, { height, backgroundColor: trackColor }]}
      onLayout={handleLayout}
      pointerEvents="none"
    >
      <Animated.View
        style={[
          styles.fill,
          {
            transform: [{ translateX }, { scaleX }],
          },
        ]}
      >
        {fillColor ? (
          <View style={[styles.layer, { backgroundColor: fillColor }]} />
        ) : (
          <>
            {/* Red base tier (active below 20%) */}
            <View style={[styles.layer, { backgroundColor: redColor }]} />

            {/* Yellow tier (transitions between 20% and 50%) */}
            <Animated.View
              style={[
                styles.layer,
                { backgroundColor: yellowColor, opacity: yellowOpacity },
              ]}
            />

            {/* White tier (transitions between 50% and 100%) */}
            <Animated.View
              style={[
                styles.layer,
                { backgroundColor: whiteColor, opacity: whiteOpacity },
              ]}
            />
          </>
        )}
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  track: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    zIndex: 20,
  },
  fill: {
    height: '100%',
    width: '100%',
    overflow: 'hidden',
  },
  layer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
});

export default NavbarTimerProgress;
