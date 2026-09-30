import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Appearance, Platform, useColorScheme as useSystemColorScheme } from 'react-native';

import { findGradient, type GradientId } from '@/constants/theme';

export type ThemePreference = 'system' | 'light' | 'dark';

const MODE_KEY = 'theme-preference';
const GRADIENT_KEY = 'theme-gradient';

type Value = {
  /** What the person chose. */
  preference: ThemePreference;
  setPreference: (next: ThemePreference) => void;
  /** What to draw right now: their choice, or the phone's setting when they chose System. */
  scheme: 'light' | 'dark';
  /** The chosen background gradient, or null for the plain background. */
  gradient: GradientId | null;
  setGradient: (next: GradientId | null) => void;
};

const ThemePreferenceContext = createContext<Value>({
  preference: 'system',
  setPreference: () => {},
  scheme: 'light',
  gradient: null,
  setGradient: () => {},
});

function isPreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

/**
 * Remembers the light/dark/system choice and the background gradient on this device. Also tells the
 * phone about light/dark, so the parts the system draws itself (alerts, the status bar) follow it too.
 */
export function ThemePreferenceProvider({ children }: { children: ReactNode }) {
  const system = useSystemColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [gradient, setGradientState] = useState<GradientId | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Applies the choice to the phone. 'unspecified' hands control back to the system setting.
  const applyToPhone = (next: ThemePreference) => {
    if (Platform.OS === 'web') return;
    try {
      Appearance.setColorScheme(next === 'system' ? 'unspecified' : next);
    } catch {
      // The app still draws the right colours without it.
    }
  };

  useEffect(() => {
    Promise.all([AsyncStorage.getItem(MODE_KEY), AsyncStorage.getItem(GRADIENT_KEY)])
      .then(([mode, savedGradient]) => {
        if (isPreference(mode)) {
          setPreferenceState(mode);
          applyToPhone(mode);
        }
        const found = findGradient(savedGradient);
        if (found) setGradientState(found.id);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    applyToPhone(next);
    AsyncStorage.setItem(MODE_KEY, next).catch(() => {});
  }, []);

  const setGradient = useCallback((next: GradientId | null) => {
    setGradientState(next);
    (next ? AsyncStorage.setItem(GRADIENT_KEY, next) : AsyncStorage.removeItem(GRADIENT_KEY)).catch(() => {});
  }, []);

  const value = useMemo<Value>(
    () => ({
      preference,
      setPreference,
      scheme: preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference,
      gradient,
      setGradient,
    }),
    [preference, setPreference, system, gradient, setGradient],
  );

  // Hold the splash screen until the saved choices are known, so the app doesn't flash the wrong theme.
  if (!loaded) return null;
  return <ThemePreferenceContext.Provider value={value}>{children}</ThemePreferenceContext.Provider>;
}

export function useThemePreference() {
  return useContext(ThemePreferenceContext);
}
