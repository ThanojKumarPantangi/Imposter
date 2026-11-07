import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Platform,
  LayoutChangeEvent,
} from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import NavbarTimerProgress from './NavbarTimerProgress';

export type TurnNotificationVariant = 'next' | 'me' | 'other' | 'voting';

export interface TurnNotificationBannerProps {
  visible: boolean;
  variant: TurnNotificationVariant;
  text: string;
  deadline?: number | null;
  totalDurationSeconds?: number;
}

export const TurnNotificationBanner: React.FC<TurnNotificationBannerProps> = ({
  visible,
  variant,
  text,
  deadline,
  totalDurationSeconds = 30,
}) => {
  const [shouldRender, setShouldRender] = useState<boolean>(visible);
  const [measuredHeight, setMeasuredHeight] = useState<number>(90);

  const animValue = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const bgAnimValue = useRef(
    new Animated.Value(variant === 'next' ? 1 : 0)
  ).current;

  // Entrance and exit animation
  useEffect(() => {
    if (visible) {
      setShouldRender(true);

      Animated.timing(animValue, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    } else {
      Animated.timing(animValue, {
        toValue: 0,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (finished) {
          setShouldRender(false);
        }
      });
    }
  }, [visible, animValue]);

  // Background transition
  useEffect(() => {
    Animated.timing(bgAnimValue, {
      toValue: variant === 'next' ? 1 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [variant, bgAnimValue]);

  const handleLayout = (e: LayoutChangeEvent) => {
    const height = e.nativeEvent.layout.height;

    if (height > 0 && Math.abs(height - measuredHeight) > 1) {
      setMeasuredHeight(height);
    }
  };

  if (!visible && !shouldRender) {
    return null;
  }

  const animatedHeight = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, measuredHeight],
    extrapolate: 'clamp',
  });

  const animatedOpacity = animValue.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0, 0.3, 1],
    extrapolate: 'clamp',
  });

  const backgroundColor = bgAnimValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(7, 9, 14, 0)', '#38BDF8'],
  });

  const isNext = variant === 'next';

  return (
    <Animated.View
      style={[
        styles.animatedWrapper,
        {
          height: animatedHeight,
          opacity: animatedOpacity,
        },
      ]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <Animated.View
        onLayout={handleLayout}
        style={[
          styles.bannerContent,
          { backgroundColor },
        ]}
      >
        <View style={styles.titleRow}>
          <Text
            style={[
              styles.titleText,
              { color: isNext ? '#000000' : '#FFFFFF' },
              !isNext && styles.normalText,
            ]}
          >
            {text}
          </Text>

          {isNext && (
            <AlertTriangle
              size={18}
              color="#000000"
              strokeWidth={2}
              style={styles.alertIcon}
            />
          )}
        </View>

        {/* Timer is now visually part of the unified navbar */}
        <NavbarTimerProgress
          deadline={deadline}
          totalDurationSeconds={totalDurationSeconds}
          height={3.5}
        />
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  animatedWrapper: {
    width: '100%',
    overflow: 'hidden',
  },

  bannerContent: {
    width: '100%',
    paddingHorizontal: 16,
    paddingTop: 22,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    borderBottomLeftRadius: 45,
    borderBottomRightRadius: 45,
    overflow: 'hidden',
  },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  titleText: {
    fontSize: 24,
    fontWeight: '700',
    fontFamily: Platform.OS === 'android' ? 'serif' : 'Georgia',
    textAlign: 'center',
  },

  normalText: {
    fontFamily: Platform.OS === 'android' ? 'sans-serif' : 'System',
    fontSize: 24,
    fontWeight: '600',
  },

  alertIcon: {
    marginLeft: 6,
    marginTop: -2,
  },
});

export default TurnNotificationBanner;