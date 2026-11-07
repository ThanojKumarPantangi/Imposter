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

export interface YouAreNextBannerProps {
  visible: boolean;
}

export const YouAreNextBanner: React.FC<YouAreNextBannerProps> = ({
  visible,
}) => {
  const [shouldRender, setShouldRender] = useState<boolean>(visible);
  const [measuredHeight, setMeasuredHeight] = useState<number>(104);
  const animValue = useRef(new Animated.Value(visible ? 1 : 0)).current;

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

  const handleLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0 && Math.abs(h - measuredHeight) > 1) {
      setMeasuredHeight(h);
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
      <View onLayout={handleLayout} style={styles.bannerContent}>
        {/* Main Title Row: Centered "You're next ⚠️" */}
        <View style={styles.titleRow}>
          <Text style={styles.titleText}>You're next</Text>
          <AlertTriangle
            size={24}
            color="#000000"
            strokeWidth={1}
            style={styles.alertIcon}
          />
        </View>
      </View>
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
    backgroundColor: '#FFE600', // Bright yellow matching reference
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  titleText: {
    color: '#000000',
    fontSize: 24,
    fontWeight: '700',
    fontFamily: Platform.OS === 'android' ? 'serif' : 'Georgia',
    marginRight: 6,
  },
  alertIcon: {
    marginLeft: 2,
    marginTop: -2,
  },
});

export default YouAreNextBanner;