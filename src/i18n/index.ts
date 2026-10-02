import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import hi from './locales/hi.json';
import kn from './locales/kn.json';
import ml from './locales/ml.json';
import ta from './locales/ta.json';

const i18n = createInstance();

// English is the source of every text and the fallback, so a string that has not been translated yet
// shows in English instead of showing its key.
i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, hi: { translation: hi }, ta: { translation: ta }, ml: { translation: ml }, kn: { translation: kn } },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  // The texts are bundled with the app, so there is nothing to wait for.
  initAsync: false,
});

export default i18n;
