import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Appearance, Platform, useColorScheme as useSystemColorScheme } from 'react-native';

export type ThemePreference = 'system' | 'light' | 'dark';

const KEY = 'theme-preference';

type Value = {
  /** What the person chose. */
  preference: ThemePreference;
  setPreference: (next: ThemePreference) => void;
  /** What to draw right now: their choice, or the phone's setting when they chose System. */
  scheme: 'light' | 'dark';
};

const ThemePreferenceContext = createContext<Value>({ preference: 'system', setPreference: () => {}, scheme: 'light' });

function isPreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

/**
 * Remembers the light/dark/system choice on this device. Also tells the phone, so the parts the
 * system draws itself (alerts, the tab bar, the status bar) follow the choice too.
 */
export function ThemePreferenceProvider({ children }: { children: ReactNode }) {
  const system = useSystemColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
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
    AsyncStorage.getItem(KEY)
      .then((stored) => {
        if (isPreference(stored)) {
          setPreferenceState(stored);
          applyToPhone(stored);
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    applyToPhone(next);
    AsyncStorage.setItem(KEY, next).catch(() => {});
  }, []);

  const value = useMemo<Value>(
    () => ({ preference, setPreference, scheme: preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference }),
    [preference, setPreference, system],
  );

  // Hold the splash screen until the saved choice is known, so the app doesn't flash the wrong theme.
  if (!loaded) return null;
  return <ThemePreferenceContext.Provider value={value}>{children}</ThemePreferenceContext.Provider>;
}

export function useThemePreference() {
  return useContext(ThemePreferenceContext);
}
