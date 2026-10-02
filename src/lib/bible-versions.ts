// Every Bible version the reader can show: the English public-domain ones from bible-api.com, and one
// version per Indian language from the wldeh/bible-api dataset (served by a CDN). The English codes are
// the ones the daily verse also uses; the Indian ones are for reading only.

import { TRANSLATIONS, type TranslationCode } from './bible-books';

/** Versions served from the dataset's CDN. The id is the dataset's folder name. */
export const INDIAN_VERSIONS = {
  'hi-irv': {
    language: 'hi',
    datasetId: 'hi-IN-irvhin',
    short: 'IRV',
    name: 'Indian Revised Version (2019)',
    credit: 'Indian Revised Version (IRV) Hindi, 2019',
  },
  'ta-irv': {
    language: 'ta',
    datasetId: 'ta-irvtam',
    short: 'IRV',
    name: 'Indian Revised Version (2019)',
    credit: 'Indian Revised Version (IRV) Tamil, 2019',
  },
  // The dataset's Malayalam IRV holds only 8 books, so Malayalam uses the complete Biblica Open version.
  'ml-omcv': {
    language: 'ml',
    datasetId: 'ml-omcv',
    short: 'OMCV',
    name: 'Open Malayalam Contemporary Version (2020)',
    credit: 'Biblica® Open Malayalam Contemporary Version, 2020',
  },
  // The dataset's Kannada IRV lacks Song of Solomon and Acts, so Kannada also uses the complete Biblica Open version.
  'kn-okcv': {
    language: 'kn',
    datasetId: 'kn-okcv',
    short: 'OKCV',
    name: 'Open Kannada Contemporary Version (2022)',
    credit: 'Biblica® Open Kannada Contemporary Version, 2022',
  },
} as const;

export type IndianVersionCode = keyof typeof INDIAN_VERSIONS;
export type BibleVersionCode = TranslationCode | IndianVersionCode;

export function isIndianVersion(code: string): code is IndianVersionCode {
  return code in INDIAN_VERSIONS;
}

/** The Indian version for a language, if there is one. */
export function indianVersionFor(language: string): IndianVersionCode | undefined {
  return (Object.keys(INDIAN_VERSIONS) as IndianVersionCode[]).find((code) => INDIAN_VERSIONS[code].language === language);
}

export type VersionInfo = { code: BibleVersionCode; short: string; name: string };

/** What to offer in the reader for a Bible language: its own version first, then the English ones. */
export function versionsFor(language: string): VersionInfo[] {
  const own = indianVersionFor(language);
  return [
    ...(own ? [{ code: own, short: INDIAN_VERSIONS[own].short, name: INDIAN_VERSIONS[own].name }] : []),
    ...TRANSLATIONS.map((t) => ({ code: t.code, short: t.short, name: t.name })),
  ];
}

/** The version shown first for a Bible language. */
export function defaultVersionFor(language: string): BibleVersionCode {
  return indianVersionFor(language) ?? 'web';
}

/** The credit line to show under text from a version, or null for versions that need none shown. */
export function creditFor(code: BibleVersionCode): string | null {
  return isIndianVersion(code) ? INDIAN_VERSIONS[code].credit : null;
}

/** The language a version is written in, which is also the language of its book names. */
export function languageOf(code: BibleVersionCode): string {
  return isIndianVersion(code) ? INDIAN_VERSIONS[code].language : 'en';
}
