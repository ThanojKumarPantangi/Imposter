import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { COLORS } from '../../theme/colors';
import { RADIUS, SHADOWS, SPACING } from '../../theme/spacing';

export type CardVariant = 'default' | 'interactive' | 'imposter' | 'civilian' | 'purple';

interface CardProps {
  children: React.ReactNode;
  variant?: CardVariant;
  style?: ViewStyle;
}

export const Card: React.FC<CardProps> = ({ children, variant = 'default', style }) => {
  const getVariantStyle = () => {
    switch (variant) {
      case 'imposter':
        return [styles.imposterCard, SHADOWS.imposterGlow];
      case 'civilian':
        return [styles.civilianCard, SHADOWS.civilianGlow];
      case 'purple':
        return styles.purpleCard;
      default:
        return styles.defaultCard;
    }
  };

  return <View style={[styles.base, getVariantStyle(), SHADOWS.card, style]}>{children}</View>;
};

const styles = StyleSheet.create({
  base: {
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    overflow: 'hidden',
  },
  defaultCard: {
    backgroundColor: 'rgba(13, 17, 23, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(51, 65, 85, 0.65)',
  },
  imposterCard: {
    backgroundColor: 'rgba(30, 10, 16, 0.94)',
    borderWidth: 1.5,
    borderColor: 'rgba(244, 63, 94, 0.55)',
  },
  civilianCard: {
    backgroundColor: 'rgba(6, 26, 36, 0.94)',
    borderWidth: 1.5,
    borderColor: 'rgba(6, 182, 212, 0.55)',
  },
  purpleCard: {
    backgroundColor: 'rgba(24, 12, 36, 0.94)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.4)',
  },
});

