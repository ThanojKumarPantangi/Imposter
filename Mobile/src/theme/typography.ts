import { TextStyle } from 'react-native';

export const FONT_SIZES = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 18,
  xl: 22,
  xxl: 28,
  hero: 34,
};

export const TYPOGRAPHY: Record<string, TextStyle> = {
  hero: {
    fontSize: FONT_SIZES.hero,
    fontWeight: '900',
    letterSpacing: -0.5,
    color: '#ffffff',
  },
  title1: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: '800',
    letterSpacing: -0.3,
    color: '#ffffff',
  },
  title2: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: '#ffffff',
  },
  title3: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: '#ffffff',
  },
  body: {
    fontSize: FONT_SIZES.md,
    fontWeight: '400',
    color: '#cbd5e1',
    lineHeight: 22,
  },
  bodyBold: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: '#ffffff',
  },
  caption: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '400',
    color: '#94a3b8',
  },
  captionBold: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: '#cbd5e1',
  },
  badge: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  code: {
    fontFamily: 'monospace',
    fontSize: FONT_SIZES.xl,
    fontWeight: '800',
    letterSpacing: 4,
  },
};

