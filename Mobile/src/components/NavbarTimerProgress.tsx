
import React, { useEffect, useRef, useState, useCallback, memo } from 'react';
import {
  View,
  Animated,
  Easing,
  StyleSheet,
  LayoutChangeEvent,
  AppState,
  AppStateStatus,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { serverTimeSync } from '../utils/serverTimeSync';

const AnimatedPath = Animated.createAnimatedComponent(Path);

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

const BANNER_RADIUS = 45;
const CURVE_K = 0.5522848;

export const NavbarTimerProgress: React.FC<NavbarTimerProgressProps> = memo(({
  deadline,
  totalDurationSeconds = 30,
  height = 2.5,
  trackColor = 'rgba(0, 0, 0, 0.15)',
  fillColor,
  whiteColor = '#FFFFFF',
  yellowColor = '#333333',
  redColor = '#FF3333',
  onExpire,
}) => {
  const progressAnim = useRef(new Animated.Value(0)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);
  const onExpireRef = useRef(onExpire);
  const hasExpiredRef = useRef(false);
  const animStartTimeRef = useRef<number>(0);
  const animStartProgressRef = useRef<number>(0);

  const [layoutWidth, setLayoutWidth] = useState(0);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width;

    if (width > 0) {
      setLayoutWidth(previous =>
        Math.abs(previous - width) > 1 ? width : previous
      );
    }
  }, []);

  // Start countdown using authoritative server time.
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
          onExpireRef.current?.();
        }

        return;
      }

      hasExpiredRef.current = false;

      const currentProgress = Math.min(
        1,
        Math.max(0, remainingMs / totalMs)
      );

      progressAnim.setValue(currentProgress);
      animStartTimeRef.current = Date.now();
      animStartProgressRef.current = currentProgress;

      const animation = Animated.timing(progressAnim, {
        toValue: 0,
        duration: remainingMs,
        easing: Easing.linear,

        // SVG strokeDashoffset requires the JS animation driver.
        useNativeDriver: false,
      });

      animRef.current = animation;

      animation.start(({ finished }) => {
        if (finished) {
          animRef.current = null;

          if (!hasExpiredRef.current) {
            hasExpiredRef.current = true;
            onExpireRef.current?.();
          }
        }
      });
    },
    [progressAnim]
  );

  // Restart when deadline or configured duration changes.
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
  }, [deadline, totalDurationSeconds, startAnimation, progressAnim]);

  // Resynchronize when the app returns to foreground.
  useEffect(() => {
    if (!deadline) return;

    const subscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        if (nextState === 'active' && deadline) {
          startAnimation(deadline, totalDurationSeconds);
        }
      }
    );

    return () => subscription.remove();
  }, [deadline, totalDurationSeconds, startAnimation]);

  // Resynchronize when the server clock offset changes.
  useEffect(() => {
    if (!deadline) return;

    const unsubscribe = serverTimeSync.subscribe((serverNow) => {
      const remainingMs = Math.max(0, deadline - serverNow);
      const totalMs = Math.max(1, totalDurationSeconds || 30) * 1000;

      const targetProgress = Math.min(
        1,
        Math.max(0, remainingMs / totalMs)
      );

      const elapsed = Date.now() - animStartTimeRef.current;

      const currentExpectedProgress = Math.max(
        0,
        animStartProgressRef.current - elapsed / totalMs
      );

      if (Math.abs(currentExpectedProgress - targetProgress) > 0.05) {
        startAnimation(deadline, totalDurationSeconds);
      }
    });

    return () => unsubscribe();
  }, [deadline, totalDurationSeconds, startAnimation]);

  if (!deadline) {
    return null;
  }

  // Wait until the actual banner width has been measured.
  if (layoutWidth <= 0) {
    return (
      <View
        style={styles.measureContainer}
        onLayout={handleLayout}
        pointerEvents="none"
      />
    );
  }

  /*
   * Create an inset U-shaped path matching the banner's
   * 45px bottom-left and bottom-right corner radius.
   */
  const radius = Math.min(
    Math.max(0, BANNER_RADIUS - height / 2),
    layoutWidth / 2
  );

  const curveOffset = radius * CURVE_K;

  const pathLength =
    layoutWidth - 2 * radius + Math.PI * radius;

  const path = `
    M 0 0
    C 0 ${curveOffset}
      ${radius - curveOffset} ${radius}
      ${radius} ${radius}
    L ${layoutWidth - radius} ${radius}
    C ${layoutWidth - radius + curveOffset} ${radius}
      ${layoutWidth} ${curveOffset}
      ${layoutWidth} 0
  `;

  // Progress goes from 100% to 0% along the complete curved path.
  const dashOffset = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [pathLength, 0],
    extrapolate: 'clamp',
  });

  // White -> yellow -> red color transitions.
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
      style={styles.curvedTrack}
      onLayout={handleLayout}
      pointerEvents="none"
    >
      <Svg
        width={layoutWidth}
        height={BANNER_RADIUS}
        viewBox={`0 0 ${layoutWidth} ${BANNER_RADIUS}`}
        preserveAspectRatio="none"
      >
        {/* Background track follows the complete banner curve. */}
        <Path
          d={path}
          fill="none"
          stroke={trackColor}
          strokeWidth={height}
          strokeLinecap="butt"
        />

        {fillColor ? (
          <AnimatedPath
            d={path}
            fill="none"
            stroke={fillColor}
            strokeWidth={height}
            strokeLinecap="round"
            strokeDasharray={`${pathLength} ${pathLength}`}
            strokeDashoffset={dashOffset}
          />
        ) : (
          <>
            {/* Red base progress. */}
            <AnimatedPath
              d={path}
              fill="none"
              stroke={redColor}
              strokeWidth={height}
              strokeLinecap="round"
              strokeDasharray={`${pathLength} ${pathLength}`}
              strokeDashoffset={dashOffset}
            />

            {/* Yellow progress tier. */}
            <AnimatedPath
              d={path}
              fill="none"
              stroke={yellowColor}
              strokeWidth={height}
              strokeLinecap="round"
              strokeDasharray={`${pathLength} ${pathLength}`}
              strokeDashoffset={dashOffset}
              opacity={yellowOpacity}
            />

            {/* White progress tier. */}
            <AnimatedPath
              d={path}
              fill="none"
              stroke={whiteColor}
              strokeWidth={height}
              strokeLinecap="round"
              strokeDasharray={`${pathLength} ${pathLength}`}
              strokeDashoffset={dashOffset}
              opacity={whiteOpacity}
            />
          </>
        )}
      </Svg>
    </View>
  );
});

const styles = StyleSheet.create({
  measureContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: BANNER_RADIUS,
  },

  curvedTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: BANNER_RADIUS,
    zIndex: 20,
    overflow: 'hidden',
  },
});

export default NavbarTimerProgress;
