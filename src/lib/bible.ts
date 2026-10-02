// Reads Bible text for the reader, the study screens and the verse previews.
//
// English versions come from bible-api.com (free, no key, public-domain translations only).
// Indian-language versions come from the wldeh/bible-api dataset through a CDN, one file per chapter.
// A preview is only for the reader to see: the save-daily-verse function fetches the text again on the
// server, and that copy is the one stored.

import i18n from '@/i18n';

import { bookFolder, bookLabel } from './bible-book-label';
import { formatReference } from './bible-books';
import { INDIAN_VERSIONS, isIndianVersion, type BibleVersionCode } from './bible-versions';

export type Passage = {
  translation: BibleVersionCode;
  book: string;
  chapter: number;
  verseStart: number;
  verseEnd: number;
};

export type VerseLookup = { reference: string; text: string };

export type ChapterText = { reference: string; verses: { number: number; text: string }[] };

const CDN = 'https://cdn.jsdelivr.net/gh/wldeh/bible-api/bibles';

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { signal });
  } catch (e) {
    if (signal?.aborted) throw e;
    throw new Error(i18n.t('bible.offline'));
  }
  if (!response.ok) throw new Error(i18n.t('bible.unavailable'));
  return response.json();
}

const tidy = (text: string) => text.replace(/\s+/g, ' ').trim();

/** One chapter of an Indian-language version. The dataset can repeat a verse, so keep the first of each number. */
async function indianChapter(version: BibleVersionCode, book: string, chapter: number, signal?: AbortSignal) {
  if (!isIndianVersion(version)) throw new Error(i18n.t('bible.unavailable'));
  const info = INDIAN_VERSIONS[version];
  const folder = bookFolder(book, info.language);
  if (!folder) throw new Error(i18n.t('bible.unavailable'));

  const body = await fetchJson<{ data?: { verse: string | number; text: string }[] }>(
    `${CDN}/${info.datasetId}/books/${encodeURIComponent(folder)}/chapters/${chapter}.json`,
    signal,
  );
  const seen = new Set<number>();
  const verses: { number: number; text: string }[] = [];
  for (const v of body.data ?? []) {
    const number = Number(v.verse);
    const text = tidy(v.text ?? '');
    if (!Number.isInteger(number) || !text || seen.has(number)) continue;
    seen.add(number);
    verses.push({ number, text });
  }
  if (!verses.length) throw new Error(i18n.t('bible.unavailable'));
  return { language: info.language, verses: verses.sort((a, b) => a.number - b.number) };
}

/** A whole chapter, verse by verse, for the Bible reader. */
export async function lookUpChapter(
  version: BibleVersionCode,
  book: string,
  chapter: number,
  signal?: AbortSignal,
): Promise<ChapterText> {
  if (isIndianVersion(version)) {
    const { language, verses } = await indianChapter(version, book, chapter, signal);
    return { reference: `${bookLabel(book, language)} ${chapter}`, verses };
  }

  const reference = `${bookLabel(book, 'en')} ${chapter}`;
  const body = await fetchJson<{ verses?: { verse: number; text: string }[] }>(
    `https://bible-api.com/${encodeURIComponent(reference)}?translation=${version}`,
    signal,
  );
  const verses = body.verses?.map((v) => ({ number: v.verse, text: tidy(v.text) }));
  if (!verses?.length) throw new Error(i18n.t('bible.unavailable'));
  return { reference, verses };
}

export async function lookUpPassage(passage: Passage, signal?: AbortSignal): Promise<VerseLookup> {
  const { translation, book, chapter, verseStart, verseEnd } = passage;

  if (isIndianVersion(translation)) {
    const { language, verses } = await indianChapter(translation, book, chapter, signal);
    const text = verses
      .filter((v) => v.number >= verseStart && v.number <= verseEnd)
      .map((v) => v.text)
      .join(' ');
    if (!text) throw new Error(i18n.t('bible.unavailable'));
    return { reference: formatReference(bookLabel(book, language), chapter, verseStart, verseEnd), text };
  }

  const reference = formatReference(bookLabel(book, 'en'), chapter, verseStart, verseEnd);
  const body = await fetchJson<{ text?: string }>(
    `https://bible-api.com/${encodeURIComponent(reference)}?translation=${translation}`,
    signal,
  );
  const text = body.text ? tidy(body.text) : '';
  if (!text) throw new Error(i18n.t('bible.unavailable'));
  return { reference, text };
}
