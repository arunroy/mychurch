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
 * The themes a person can choose. Each one is a matched set: a background gradient with the text and
 * accent colours chosen to read well on it, in a light and a dark version. People pick a whole theme
 * rather than mixing colours, so every combination looks designed. Contrast was checked for each:
 * text 7:1 or better, secondary text and `accentText` 4.5:1 or better on the gradient and on cards,
 * and white text on `accent` 4.5:1 or better.
 *
 * `accent` fills buttons and selected chips (white text on top). `accentText` is the same hue made
 * readable as text or an icon on the background.
 */
export const THEMES = [
  {
    id: 'dawn',
    name: 'Dawn',
    light: { gradient: ['#FFE9D6', '#FFC9DC'], text: '#2B1720', textSecondary: '#6A4150', accent: '#C2255C', accentText: '#AF2153' },
    dark: { gradient: ['#3A1F2E', '#1D1B3D'], text: '#FDF2F6', textSecondary: '#D3BBC8', accent: '#D6336C', accentText: '#E88DAD' },
  },
  {
    id: 'ocean',
    name: 'Ocean',
    light: { gradient: ['#D6F0FF', '#C9F5EA'], text: '#10262F', textSecondary: '#3F5F6B', accent: '#0B7285', accentText: '#0B7285' },
    dark: { gradient: ['#0B2A44', '#0B3B3B'], text: '#EAF6FB', textSecondary: '#B5CFDA', accent: '#1A76C9', accentText: '#91BDE5' },
  },
  {
    id: 'meadow',
    name: 'Meadow',
    light: { gradient: ['#E3F7D3', '#CDEFE0'], text: '#14281A', textSecondary: '#42604A', accent: '#29843C', accentText: '#247534' },
    dark: { gradient: ['#15321E', '#0F3432'], text: '#ECF8EF', textSecondary: '#B8D3BF', accent: '#278539', accentText: '#8BBD94' },
  },
  {
    id: 'twilight',
    name: 'Twilight',
    light: { gradient: ['#E6DCFF', '#CFE0FF'], text: '#1E1B3A', textSecondary: '#504C78', accent: '#5F3DC4', accentText: '#5F3DC4' },
    dark: { gradient: ['#2A1F55', '#15254D'], text: '#F1EEFF', textSecondary: '#C5BFE6', accent: '#7048E8', accentText: '#B29CF3' },
  },
  {
    id: 'sunset',
    name: 'Sunset',
    light: { gradient: ['#FFF0C7', '#FFD2C2'], text: '#2E1B10', textSecondary: '#6B4A36', accent: '#C2410C', accentText: '#A7380A' },
    dark: { gradient: ['#47280F', '#45182A'], text: '#FFF4E8', textSecondary: '#E3C9B4', accent: '#C84D0A', accentText: '#E3A685' },
  },
  {
    id: 'mist',
    name: 'Mist',
    light: { gradient: ['#ECEFF4', '#D9E2EC'], text: '#1A2230', textSecondary: '#4A5668', accent: '#364FC7', accentText: '#364FC7' },
    dark: { gradient: ['#1F252D', '#2B3440'], text: '#F1F4F8', textSecondary: '#BAC4D1', accent: '#496AEB', accentText: '#A8B7F5' },
  },
  {
    id: 'lavender',
    name: 'Lavender',
    light: { gradient: ['#F1E4FB', '#E0E7FF'], text: '#2A1A3A', textSecondary: '#5E4A78', accent: '#862E9C', accentText: '#862E9C' },
    dark: { gradient: ['#2E1F45', '#1F2350'], text: '#F6EEFF', textSecondary: '#CDBFE3', accent: '#AE3EC9', accentText: '#D293E1' },
  },
  {
    id: 'forest',
    name: 'Forest',
    light: { gradient: ['#E2EFE6', '#CBE3D4'], text: '#11261B', textSecondary: '#3F5E4D', accent: '#2F6B4F', accentText: '#2F6B4F' },
    dark: { gradient: ['#0F2A1D', '#173A2A'], text: '#E9F6EE', textSecondary: '#B0CDBB', accent: '#2B845C', accentText: '#95C1AE' },
  },
  {
    id: 'rose',
    name: 'Rose',
    light: { gradient: ['#FDEBEE', '#F6D5DD'], text: '#301A20', textSecondary: '#6B4650', accent: '#A61E4D', accentText: '#A61E4D' },
    dark: { gradient: ['#3B1A24', '#2A1A2E'], text: '#FFF0F3', textSecondary: '#E0BFC9', accent: '#D6336C', accentText: '#E789AA' },
  },
  {
    id: 'sand',
    name: 'Sand',
    light: { gradient: ['#F8F0E3', '#EBDCC3'], text: '#2B2116', textSecondary: '#66553F', accent: '#8C5A2B', accentText: '#845528' },
    dark: { gradient: ['#2E2618', '#3A2C1A'], text: '#FBF3E6', textSecondary: '#D6C5A8', accent: '#A26529', accentText: '#CDAC8C' },
  },
  {
    id: 'sky',
    name: 'Sky',
    light: { gradient: ['#E3F2FF', '#F2F8FF'], text: '#0F2338', textSecondary: '#44607C', accent: '#1971C2', accentText: '#186CBA' },
    dark: { gradient: ['#0E2741', '#12335A'], text: '#EAF4FF', textSecondary: '#B3CAE3', accent: '#1A76C9', accentText: '#8DBBE4' },
  },
  {
    id: 'berry',
    name: 'Berry',
    light: { gradient: ['#F7E1EE', '#E9D5F5'], text: '#321530', textSecondary: '#6A4868', accent: '#A61E6B', accentText: '#A61E6B' },
    dark: { gradient: ['#3A1735', '#2A1B4A'], text: '#FDEFFA', textSecondary: '#DABFD5', accent: '#C2255C', accentText: '#DF8EAA' },
  },
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];

export function findTheme(id: string | null | undefined) {
  return THEMES.find((t) => t.id === id);
}

/**
 * Surfaces when a theme is chosen. Cards are see-through so the gradient still shows, and
 * `background` (used inside inputs) stays solid enough to read.
 */
export const ThemeSurfaces = {
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
