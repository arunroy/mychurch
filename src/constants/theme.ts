/**
 * Neutral colours for light and dark mode. Each church adds its own accent colour on top
 * (see useAccent), so nothing here should be brand-coloured.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
    danger: '#B42318',
    dangerBackground: '#FEE4E2',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
    danger: '#FDA29B',
    dangerBackground: '#55160C',
  },
} as const;

export const DEFAULT_ACCENT = '#3B5BDB';

/** Colours a Pastor can pick for their church. All keep white text readable. */
export const ACCENT_CHOICES = ['#3B5BDB', '#2F9E44', '#C2255C', '#7048E8', '#E8590C', '#0C8599', '#5C3D2E', '#343A40'];

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/**
 * Background gradients a person can choose for the whole app. Each has a soft version for light
 * mode (dark text stays readable) and a deep one for dark mode (white text stays readable).
 */
export const GRADIENTS = [
  { id: 'dawn', name: 'Dawn', light: ['#FFE9D6', '#FFC9DC'], dark: ['#3A1F2E', '#1D1B3D'] },
  { id: 'ocean', name: 'Ocean', light: ['#D6F0FF', '#C9F5EA'], dark: ['#0B2A44', '#0B3B3B'] },
  { id: 'meadow', name: 'Meadow', light: ['#E3F7D3', '#CDEFE0'], dark: ['#15321E', '#0F3432'] },
  { id: 'twilight', name: 'Twilight', light: ['#E6DCFF', '#CFE0FF'], dark: ['#2A1F55', '#15254D'] },
  { id: 'sunset', name: 'Sunset', light: ['#FFF0C7', '#FFD2C2'], dark: ['#47280F', '#45182A'] },
  { id: 'mist', name: 'Mist', light: ['#ECEFF4', '#D9E2EC'], dark: ['#1F252D', '#2B3440'] },
] as const;

export type GradientId = (typeof GRADIENTS)[number]['id'];

export function findGradient(id: string | null | undefined) {
  return GRADIENTS.find((g) => g.id === id);
}

/**
 * Surfaces when a gradient shows through. Cards are see-through so the gradient still shows, and
 * `background` (used inside inputs) stays solid enough to read.
 */
export const GradientSurfaces = {
  light: {
    background: 'rgba(255,255,255,0.92)',
    backgroundElement: 'rgba(255,255,255,0.72)',
    backgroundSelected: 'rgba(0,0,0,0.08)',
  },
  dark: {
    background: 'rgba(0,0,0,0.40)',
    backgroundElement: 'rgba(255,255,255,0.10)',
    backgroundSelected: 'rgba(255,255,255,0.18)',
  },
} as const;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
