import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { COLORS } from '../../theme/colors';
import { RADIUS, SPACING } from '../../theme/spacing';

interface BadgeProps {
  label: string;
  variant?: 'imposter' | 'civilian' | 'purple' | 'amber' | 'neutral';
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'imposter',
  icon,
  style,
  textStyle,
}) => {
  const getBadgeStyle = () => {
    switch (variant) {
      case 'imposter':
        return {
          container: styles.imposterContainer,
          text: styles.imposterText,
        };
      case 'civilian':
        return {
          container: styles.civilianContainer,
          text: styles.civilianText,
        };
      case 'purple':
        return {
          container: styles.purpleContainer,
          text: styles.purpleText,
        };
      case 'amber':
        return {
          container: styles.amberContainer,
          text: styles.amberText,
        };
      default:
        return {
          container: styles.neutralContainer,
          text: styles.neutralText,
        };
    }
  };

  const { container, text } = getBadgeStyle();

  return (
    <View style={[styles.base, container, style]}>
      {icon && <View style={styles.iconWrapper}>{icon}</View>}
      <Text style={[styles.textBase, text, textStyle]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
    borderRadius: RADIUS.round,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  iconWrapper: {
    marginRight: 4,
  },
  textBase: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  imposterContainer: {
    backgroundColor: 'rgba(244, 63, 94, 0.12)',
    borderColor: 'rgba(244, 63, 94, 0.4)',
  },
  imposterText: {
    color: '#fb7185',
  },
  civilianContainer: {
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
    borderColor: 'rgba(6, 182, 212, 0.4)',
  },
  civilianText: {
    color: '#22d3ee',
  },
  purpleContainer: {
    backgroundColor: 'rgba(168, 85, 247, 0.12)',
    borderColor: 'rgba(168, 85, 247, 0.4)',
  },
  purpleText: {
    color: '#c084fc',
  },
  amberContainer: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  amberText: {
    color: '#fbbf24',
  },
  neutralContainer: {
    backgroundColor: COLORS.dark[800],
    borderColor: COLORS.slate[700],
  },
  neutralText: {
    color: COLORS.slate[300],
  },
});

