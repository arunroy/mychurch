/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { useMemo } from 'react';

import { Colors, GradientSurfaces } from '@/constants/theme';
import { useThemePreference } from '@/lib/theme-preference';

export type Theme = {
  text: string;
  /** Inside inputs and other solid areas. */
  background: string;
  /** Behind a whole screen. Transparent when a gradient is chosen, so the gradient shows through. */
  page: string;
  backgroundElement: string;
  backgroundSelected: string;
  textSecondary: string;
  danger: string;
  dangerBackground: string;
};

export function useTheme(): Theme {
  const { scheme, gradient } = useThemePreference();
  return useMemo(() => {
    const base = Colors[scheme];
    if (!gradient) return { ...base, page: base.background };
    return { ...base, ...GradientSurfaces[scheme], page: 'transparent' };
  }, [scheme, gradient]);
}
