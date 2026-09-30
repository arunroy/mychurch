import { useThemePreference } from '@/lib/theme-preference';

/** The scheme to draw: the person's choice, or the phone's setting when they chose System. */
export function useColorScheme() {
  return useThemePreference().scheme;
}
