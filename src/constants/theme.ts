/**
 * Neutral colours for light and dark mode. Each church adds its own accent colour on top
 * (see useAccent), so nothing here should be brand-coloured.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#15171C',
    /** Solid surfaces: inputs, sheets. */
    background: '#FFFFFF',
    /** Behind a whole screen. */
    page: '#F5F6F8',
    /** Cards and grouped lists. */
    backgroundElement: '#FFFFFF',
    /** Quiet fills: unselected chips, secondary buttons, tracks. */
    backgroundSelected: '#EEF0F3',
    /** Outlines of fields, chips and secondary buttons. */
    border: '#E2E5EA',
    /** Dividers inside a card. */
    hairline: '#EEF0F3',
    textSecondary: '#5B6270',
    danger: '#B42318',
    dangerBackground: '#FEECEB',
  },
  dark: {
    text: '#F2F3F5',
    background: '#171A1F',
    page: '#0D0F12',
    backgroundElement: '#171A1F',
    backgroundSelected: '#23272E',
    border: '#2E333B',
    hairline: '#23272E',
    textSecondary: '#A3A9B4',
    danger: '#FDA29B',
    dangerBackground: '#3A1714',
  },
} as const;

/** The app's one accent colour, the same for every church. White text on it passes 4.5:1. */
export const ACCENT = '#3B5BDB';

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/** Corner radii, so every surface rounds the same way. */
export const Radius = {
  field: 14,
  card: 20,
  tile: 18,
  pill: 999,
} as const;

/** The soft lift under cards in light mode. Dark mode uses a hairline outline instead. */
export const CardShadow = {
  shadowColor: '#101828',
  shadowOpacity: 0.06,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 2 },
  elevation: 1,
} as const;

/** A colour at some opacity, from a #RRGGBB hex: for soft tints of the church colour. */
export function withAlpha(hex: string, alpha: number) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full.slice(0, 6), 16);
  if (Number.isNaN(n)) return hex;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/** A colour mixed toward white: the church colour made readable as text on a dark background. */
export function lighten(hex: string, amount: number) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full.slice(0, 6), 16);
  if (Number.isNaN(n)) return hex;
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  return `rgb(${mix((n >> 16) & 255)},${mix((n >> 8) & 255)},${mix(n & 255)})`;
}

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
