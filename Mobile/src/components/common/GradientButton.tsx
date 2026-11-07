import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GRADIENTS, COLORS } from '../../theme/colors';
import { RADIUS, SHADOWS, SPACING } from '../../theme/spacing';
import { sounds } from '../../utils/sound';

export type ButtonVariant = 'primary' | 'cyan' | 'secondary' | 'purple' | 'danger';

interface GradientButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  style?: ViewStyle;
  textStyle?: TextStyle;
  size?: 'sm' | 'md' | 'lg';
}

export const GradientButton: React.FC<GradientButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  icon,
  iconPosition = 'right',
  style,
  textStyle,
  size = 'md',
}) => {
  const handlePress = () => {
    if (disabled || loading) return;
    sounds.playClick();
    onPress();
  };

  const getGradient = () => {
    switch (variant) {
      case 'primary':
        return GRADIENTS.primary;
      case 'cyan':
        return GRADIENTS.cyan;
      case 'purple':
        return GRADIENTS.purple;
      default:
        return GRADIENTS.primary;
    }
  };

  const isSecondary = variant === 'secondary';

  const sizeStyle = {
    paddingVertical: size === 'sm' ? 8 : size === 'lg' ? 16 : 12,
    paddingHorizontal: size === 'sm' ? 12 : size === 'lg' ? 24 : 18,
  };

  const fontSize = size === 'sm' ? 12 : size === 'lg' ? 16 : 14;

  if (isSecondary) {
    return (
      <TouchableOpacity
        onPress={handlePress}
        disabled={disabled || loading}
        activeOpacity={0.8}
        style={[
          styles.secondaryButton,
          sizeStyle,
          disabled && styles.disabled,
          style,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={COLORS.slate[300]} size="small" />
        ) : (
          <View style={styles.contentRow}>
            {icon && iconPosition === 'left' && <View style={styles.leftIcon}>{icon}</View>}
            <Text style={[styles.secondaryText, { fontSize }, textStyle]}>{title}</Text>
            {icon && iconPosition === 'right' && <View style={styles.rightIcon}>{icon}</View>}
          </View>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={disabled || loading}
      activeOpacity={0.85}
      style={[
        variant === 'primary' ? SHADOWS.buttonPrimary : SHADOWS.buttonCyan,
        disabled && styles.disabled,
        style,
      ]}
    >
      <LinearGradient
        colors={getGradient() as any}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.gradient, sizeStyle]}
      >
        {loading ? (
          <ActivityIndicator color={COLORS.white} size="small" />
        ) : (
          <View style={styles.contentRow}>
            {icon && iconPosition === 'left' && <View style={styles.leftIcon}>{icon}</View>}
            <Text style={[styles.gradientText, { fontSize }, textStyle]}>{title}</Text>
            {icon && iconPosition === 'right' && <View style={styles.rightIcon}>{icon}</View>}
          </View>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  gradient: {
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradientText: {
    color: COLORS.white,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  secondaryButton: {
    backgroundColor: COLORS.dark[800],
    borderWidth: 1,
    borderColor: COLORS.slate[700],
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    color: COLORS.slate[200],
    fontWeight: '600',
  },
  leftIcon: {
    marginRight: SPACING.sm,
  },
  rightIcon: {
    marginLeft: SPACING.sm,
  },
  disabled: {
    opacity: 0.45,
  },
});

