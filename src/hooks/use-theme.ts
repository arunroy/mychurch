/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';
import { useThemePreference } from '@/lib/theme-preference';

export type Theme = (typeof Colors)['light'] | (typeof Colors)['dark'];

/** The colours for light or dark, as the person chose. The church's own colour comes from useAccent. */
export function useTheme(): Theme {
  return Colors[useThemePreference().scheme];
}
