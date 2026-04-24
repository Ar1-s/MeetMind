import { createAnimations } from '@tamagui/animations-moti'
import { createInterFont } from '@tamagui/font-inter'
import { shorthands } from '@tamagui/shorthands'
import { createTamagui, createTokens } from 'tamagui'

// ---------------------------------------------------------------------------
// Animations — iOS native spring style
// ---------------------------------------------------------------------------
const animations = createAnimations({
  smooth: {
    type: 'spring',
    damping: 20,
    mass: 1,
    stiffness: 300,
  },
  bouncy: {
    type: 'spring',
    damping: 15,
    mass: 0.8,
    stiffness: 200,
  },
  quick: {
    type: 'spring',
    damping: 20,
    mass: 0.7,
    stiffness: 250,
  },
  gentle: {
    type: 'spring',
    damping: 18,
    mass: 1.2,
    stiffness: 120,
  },
  lazy: {
    type: 'spring',
    damping: 22,
    mass: 1.5,
    stiffness: 80,
  },
})

// ---------------------------------------------------------------------------
// Fonts
// ---------------------------------------------------------------------------
const headingFont = createInterFont({
  size: {
    1: 11,
    2: 12,
    3: 13,
    4: 14,
    5: 16,
    6: 18,
    7: 20,
    8: 24,
    9: 28,
    10: 32,
    11: 36,
    12: 40,
  },
  weight: {
    4: '400',
    5: '500',
    6: '600',
    7: '700',
  },
  letterSpacing: {
    4: 0,
    5: -0.2,
    6: -0.3,
  },
})

const bodyFont = createInterFont({
  size: {
    1: 11,
    2: 12,
    3: 13,
    4: 14,
    5: 15,
    6: 16,
    7: 17,
    8: 18,
    9: 20,
  },
  weight: {
    4: '400',
    5: '500',
    6: '600',
    7: '700',
  },
})

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------
const tokens = createTokens({
  color: {
    // Blue primary scale
    blue1: '#eff6ff',
    blue2: '#dbeafe',
    blue3: '#bfdbfe',
    blue4: '#93bbfd',
    blue5: '#60a5fa',
    blue6: '#3b82f6',
    blue7: '#2563eb',
    blue8: '#1d4ed8',
    blue9: '#1e40af',
    blue10: '#1e3a8a',

    // Red
    red1: '#fef2f2',
    red2: '#fecaca',
    red5: '#ef4444',
    red8: '#991b1b',

    // Amber
    amber1: '#fffbeb',
    amber2: '#fef3c7',
    amber5: '#f59e0b',
    amber8: '#92400e',

    // Green
    green1: '#f0fdf4',
    green2: '#bbf7d0',
    green5: '#22c55e',
    green8: '#166534',

    // Purple
    purple5: '#7c3aed',

    // Gray scale
    gray1: '#f8fafc',
    gray2: '#f1f5f9',
    gray3: '#e2e8f0',
    gray4: '#cbd5e1',
    gray5: '#94a3b8',
    gray6: '#64748b',
    gray7: '#475569',
    gray8: '#334155',
    gray9: '#1e293b',
    gray10: '#0f172a',

    white: '#ffffff',
    black: '#000000',
    transparent: 'transparent',
  },

  space: {
    0: 0,
    0.5: 2,
    1: 4,
    1.5: 6,
    2: 8,
    2.5: 10,
    3: 12,
    3.5: 14,
    4: 16,
    5: 20,
    6: 24,
    7: 28,
    8: 32,
    9: 36,
    10: 40,
    12: 48,
    16: 64,
    true: 16,
  },

  size: {
    0: 0,
    0.5: 2,
    1: 4,
    2: 8,
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    7: 28,
    8: 32,
    9: 36,
    10: 40,
    11: 44,
    12: 48,
    14: 56,
    16: 64,
    true: 44,
  },

  radius: {
    0: 0,
    1: 3,
    2: 4,
    3: 6,
    4: 8,
    5: 10,
    6: 12,
    7: 16,
    8: 20,
    9: 24,
    10: 28,
    true: 12,
  },

  zIndex: {
    0: 0,
    1: 100,
    2: 200,
    3: 300,
    4: 400,
    5: 500,
  },
})

// ---------------------------------------------------------------------------
// Themes
// ---------------------------------------------------------------------------
const lightTheme = {
  background: '#f5f5f5',
  backgroundStrong: '#ffffff',
  backgroundSoft: '#fafafa',
  backgroundHover: '#f3f4f6',
  backgroundPress: '#e5e7eb',
  backgroundFocus: '#eff6ff',

  color: '#1a1a1a',
  colorSecondary: '#666666',
  colorTertiary: '#888888',
  colorMuted: '#aaaaaa',
  colorPlaceholder: '#cccccc',

  borderColor: '#e0e0e0',
  borderColorLight: '#f0f0f0',
  borderColorFocus: '#2563eb',

  primary: '#2563eb',
  primaryDark: '#1d4ed8',
  primaryLight: '#eff6ff',
  primaryBorder: '#bfdbfe',

  accentError: '#ef4444',
  accentErrorLight: '#fef2f2',
  accentErrorBorder: '#fecaca',
  accentWarning: '#f59e0b',
  accentWarningLight: '#fffbeb',
  accentWarningBorder: '#fef3c7',
  accentSuccess: '#22c55e',
  accentSuccessLight: '#f0fdf4',
  accentSuccessBorder: '#bbf7d0',

  cardBackground: '#ffffff',
  inputBackground: '#fafafa',
  modalOverlay: 'rgba(0,0,0,0.4)',

  shadowColor: 'rgba(0,0,0,0.06)',
}

const darkTheme: typeof lightTheme = {
  background: '#0f0f0f',
  backgroundStrong: '#1a1a1a',
  backgroundSoft: '#222222',
  backgroundHover: '#2a2a2a',
  backgroundPress: '#333333',
  backgroundFocus: '#1a2744',

  color: '#f0f0f0',
  colorSecondary: '#a0a0a0',
  colorTertiary: '#808080',
  colorMuted: '#606060',
  colorPlaceholder: '#505050',

  borderColor: '#333333',
  borderColorLight: '#2a2a2a',
  borderColorFocus: '#60a5fa',

  primary: '#60a5fa',
  primaryDark: '#3b82f6',
  primaryLight: '#1a2744',
  primaryBorder: '#1e3a6e',

  accentError: '#f87171',
  accentErrorLight: '#3b1515',
  accentErrorBorder: '#7f1d1d',
  accentWarning: '#fbbf24',
  accentWarningLight: '#3b2e08',
  accentWarningBorder: '#78350f',
  accentSuccess: '#4ade80',
  accentSuccessLight: '#0a3b1a',
  accentSuccessBorder: '#14532d',

  cardBackground: '#1a1a1a',
  inputBackground: '#222222',
  modalOverlay: 'rgba(0,0,0,0.6)',

  shadowColor: 'rgba(0,0,0,0.3)',
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const config = createTamagui({
  defaultFont: 'body',
  animations,
  shouldAddPrefersColorThemes: true,
  themeClassNameOnRoot: true,
  shorthands,
  fonts: {
    heading: headingFont,
    body: bodyFont,
  },
  themes: {
    light: lightTheme,
    dark: darkTheme,
  },
  tokens,
})

export type AppConfig = typeof config

declare module 'tamagui' {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface TamaguiCustomConfig extends AppConfig {}
}

export default config
