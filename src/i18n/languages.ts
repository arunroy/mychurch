// The languages the app is offered in. To add one: add a row here, run scripts/build-book-names.mjs for its
// Bible book names (and add its Bible version in src/lib/bible-versions.ts), and add src/i18n/locales/<code>.json.

export type LanguageCode = 'en' | 'hi' | 'ta' | 'ml' | 'kn';

export type AppLanguage = {
  code: LanguageCode;
  /** The language's name in its own script, so people can find it without reading English. */
  native: string;
  /** Not yet read through by a native speaker. */
  beta: boolean;
};

export const LANGUAGES: AppLanguage[] = [
  { code: 'en', native: 'English', beta: false },
  { code: 'hi', native: 'हिन्दी', beta: true },
  { code: 'ta', native: 'தமிழ்', beta: true },
  { code: 'ml', native: 'മലയാളം', beta: true },
  { code: 'kn', native: 'ಕನ್ನಡ', beta: true },
];

export function isLanguageCode(value: unknown): value is LanguageCode {
  return LANGUAGES.some((l) => l.code === value);
}
