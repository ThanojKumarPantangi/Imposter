export const COLORS = {
  // Dark Background hierarchy
  dark: {
    950: '#07090e',
    900: '#0d1117',
    850: '#131924',
    800: '#161e2e',
    700: '#232d42',
    600: '#334155',
  },

  // Imposter theme
  imposter: {
    default: '#f43f5e',
    glow: '#ff1e56',
    dark: '#be123c',
    bg: 'rgba(244, 63, 94, 0.12)',
    border: 'rgba(244, 63, 94, 0.35)',
  },

  // Civilian theme
  civilian: {
    default: '#06b6d4',
    glow: '#00f2fe',
    dark: '#0e7490',
    bg: 'rgba(6, 182, 212, 0.12)',
    border: 'rgba(6, 182, 212, 0.35)',
  },

  // Accents
  accent: {
    purple: '#a855f7',
    purpleBg: 'rgba(168, 85, 247, 0.15)',
    purpleBorder: 'rgba(168, 85, 247, 0.3)',
    amber: '#f59e0b',
    amberBg: 'rgba(245, 158, 11, 0.15)',
    amberBorder: 'rgba(245, 158, 11, 0.3)',
    emerald: '#10b981',
    emeraldBg: 'rgba(16, 185, 129, 0.15)',
    emeraldBorder: 'rgba(16, 185, 129, 0.3)',
  },

  // Neutral slate
  slate: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
  },

  white: '#ffffff',
  black: '#000000',
  transparent: 'transparent',
};

// Gradient color arrays for LinearGradient
export const GRADIENTS = {
  primary: ['#f43f5e', '#db2777'] as const,
  primaryHover: ['#e11d48', '#be185d'] as const,
  cyan: ['#06b6d4', '#2563eb'] as const,
  cyanHover: ['#0891b2', '#1d4ed8'] as const,
  purple: ['#a855f7', '#7c3aed'] as const,
  logo: ['#f43f5e', '#ec4899', '#9333ea'] as const,
  cardBorder: ['#334155', '#1e293b'] as const,
  imposterCard: ['rgba(244, 63, 94, 0.15)', 'rgba(13, 17, 23, 0.95)'] as const,
  civilianCard: ['rgba(6, 182, 212, 0.15)', 'rgba(13, 17, 23, 0.95)'] as const,
};

// 8 Avatar gradient pairs
export const AVATAR_GRADIENTS: readonly [string, string][] = [
  ['#f43f5e', '#db2777'],
  ['#06b6d4', '#2563eb'],
  ['#a855f7', '#4f46e5'],
  ['#f59e0b', '#ea580c'],
  ['#10b981', '#0d9488'],
  ['#d946ef', '#e11d48'],
  ['#0284c7', '#06b6d4'],
  ['#8b5cf6', '#a855f7'],
];

