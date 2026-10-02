/**
 * Neutral colours for light and dark mode. Each church adds its own accent colour on top
 * (see useAccent), so nothing here should be brand-coloured.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#111111',
    /** Solid surfaces: inputs, sheets. */
    background: '#FFFFFF',
    /** Behind a whole screen. */
    page: '#F2F2F7',
    /** Cards and grouped lists. */
    backgroundElement: '#FFFFFF',
    /** Quiet fills: unselected chips, secondary buttons, tracks. */
    backgroundSelected: '#E5E5EA',
    /** Outlines of fields, chips and secondary buttons. */
    border: '#D1D1D6',
    /** Dividers between rows of a grouped list. */
    hairline: '#E0E0E5',
    textSecondary: '#6E6E73',
    danger: '#C4251B',
    dangerBackground: '#FDECEB',
  },
  dark: {
    text: '#FFFFFF',
    background: '#1C1C1E',
    page: '#000000',
    backgroundElement: '#1C1C1E',
    backgroundSelected: '#2C2C2E',
    border: '#3A3A3C',
    hairline: '#38383A',
    textSecondary: '#98989F',
    danger: '#FF6961',
    dangerBackground: '#3A1714',
  },
} as const;

/** The app's one accent colour, the same for every church. White text on it passes 4.5:1. */
export const ACCENT = '#0A66D8';

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/** Corner radii, so every surface rounds the same way. */
export const Radius = {
  field: 12,
  card: 14,
  tile: 8,
  pill: 999,
} as const;

/** Background colours for the small icon squares beside list rows, one per kind of thing, as in the phone's Settings. */
export const IconColors = {
  blue: '#0A84FF',
  indigo: '#5856D6',
  purple: '#AF52DE',
  pink: '#FF2D55',
  red: '#FF3B30',
  orange: '#FF9500',
  amber: '#E0A100',
  green: '#34C759',
  teal: '#30B0C7',
  cyan: '#32ADE6',
  brown: '#A2845E',
  gray: '#8E8E93',
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
