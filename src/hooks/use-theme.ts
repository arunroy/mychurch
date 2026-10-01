/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { useMemo } from 'react';

import { Colors, findTheme, ThemeSurfaces } from '@/constants/theme';
import { useThemePreference } from '@/lib/theme-preference';

export type Theme = {
  text: string;
  /** Inside inputs and other solid areas. */
  background: string;
  /** Behind a whole screen. Transparent when a theme is chosen, so its gradient shows through. */
  page: string;
  backgroundElement: string;
  backgroundSelected: string;
  textSecondary: string;
  danger: string;
  dangerBackground: string;
  /** Button and chip fill, from the chosen theme. Null on the plain look, which uses the church's colour. */
  accent: string | null;
  /** The accent as text or an icon on the background. Null on the plain look. */
  accentText: string | null;
};

export function useTheme(): Theme {
  const { scheme, themeId } = useThemePreference();
  return useMemo(() => {
    const base = Colors[scheme];
    const chosen = findTheme(themeId)?.[scheme];
    if (!chosen) return { ...base, page: base.background, accent: null, accentText: null };
    return {
      ...base,
      ...ThemeSurfaces[scheme],
      text: chosen.text,
      textSecondary: chosen.textSecondary,
      page: 'transparent',
      accent: chosen.accent,
      accentText: chosen.accentText,
    };
  }, [scheme, themeId]);
}
