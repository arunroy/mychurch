import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { setDateLocale } from '@/lib/dates';

import i18n from './index';
import { isLanguageCode, type LanguageCode } from './languages';

const APP_KEY = 'app-language';
const BIBLE_KEY = 'bible-language';

/** 'app' means the Bible follows the app's language. */
export type BibleChoice = 'app' | LanguageCode;

type Value = {
  /** The language of the app's own text. */
  appLanguage: LanguageCode;
  setAppLanguage: (next: LanguageCode) => void;
  /** What the person chose for the Bible: 'app' (the default) or a language. */
  bibleChoice: BibleChoice;
  setBibleChoice: (next: BibleChoice) => void;
  /** The language the Bible is actually shown in. */
  bibleLanguage: LanguageCode;
};

const LanguageContext = createContext<Value>({
  appLanguage: 'en',
  setAppLanguage: () => {},
  bibleChoice: 'app',
  setBibleChoice: () => {},
  bibleLanguage: 'en',
});

/** The phone's own language when the app offers it, otherwise English. */
function phoneLanguage(): LanguageCode {
  try {
    const code = getLocales()[0]?.languageCode;
    return isLanguageCode(code) ? code : 'en';
  } catch {
    return 'en';
  }
}

/**
 * Remembers the app language and the Bible language on this device. The first time, the app follows the
 * phone's language and the Bible follows the app.
 */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [appLanguage, setAppLanguageState] = useState<LanguageCode>('en');
  const [bibleChoice, setBibleChoiceState] = useState<BibleChoice>('app');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([AsyncStorage.getItem(APP_KEY), AsyncStorage.getItem(BIBLE_KEY)])
      .then(([app, bible]) => {
        const language = isLanguageCode(app) ? app : phoneLanguage();
        setAppLanguageState(language);
        i18n.changeLanguage(language);
        setDateLocale(language);
        if (bible === 'app' || isLanguageCode(bible)) setBibleChoiceState(bible);
      })
      .catch(() => {
        const language = phoneLanguage();
        setAppLanguageState(language);
        i18n.changeLanguage(language);
        setDateLocale(language);
      })
      .finally(() => setLoaded(true));
  }, []);

  const setAppLanguage = useCallback((next: LanguageCode) => {
    setAppLanguageState(next);
    i18n.changeLanguage(next);
    setDateLocale(next);
    AsyncStorage.setItem(APP_KEY, next).catch(() => {});
  }, []);

  const setBibleChoice = useCallback((next: BibleChoice) => {
    setBibleChoiceState(next);
    AsyncStorage.setItem(BIBLE_KEY, next).catch(() => {});
  }, []);

  const value = useMemo<Value>(
    () => ({
      appLanguage,
      setAppLanguage,
      bibleChoice,
      setBibleChoice,
      bibleLanguage: bibleChoice === 'app' ? appLanguage : bibleChoice,
    }),
    [appLanguage, setAppLanguage, bibleChoice, setBibleChoice],
  );

  // Hold the splash screen until the saved choice is known, so the app doesn't flash the wrong language.
  if (!loaded) return null;
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}
