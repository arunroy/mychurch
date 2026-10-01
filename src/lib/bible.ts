// Previews a picked passage through bible-api.com (free, no key; public-domain translations only).
// This is a preview so the Pastor can see what they chose. The save-daily-verse function fetches
// the text again on the server, and that copy is the one stored.

import { displayBook, formatReference, type TranslationCode } from './bible-books';

export type Passage = {
  translation: TranslationCode;
  book: string;
  chapter: number;
  verseStart: number;
  verseEnd: number;
};

export type VerseLookup = { reference: string; text: string };

export type ChapterText = { reference: string; verses: { number: number; text: string }[] };

/** A whole chapter, verse by verse, for the Bible reader. */
export async function lookUpChapter(
  translation: TranslationCode,
  book: string,
  chapter: number,
  signal?: AbortSignal,
): Promise<ChapterText> {
  const reference = `${displayBook(book)} ${chapter}`;
  const unavailable = 'The Bible text is unavailable right now. Try again in a moment.';

  let response: Response;
  try {
    response = await fetch(`https://bible-api.com/${encodeURIComponent(reference)}?translation=${translation}`, { signal });
  } catch (e) {
    if (signal?.aborted) throw e;
    throw new Error('Check your internet connection and try again.');
  }
  if (!response.ok) throw new Error(unavailable);

  const body: { verses?: { verse: number; text: string }[] } = await response.json();
  const verses = body.verses?.map((v) => ({ number: v.verse, text: v.text.replace(/\s+/g, ' ').trim() }));
  if (!verses?.length) throw new Error(unavailable);
  return { reference, verses };
}

export async function lookUpPassage(passage: Passage, signal?: AbortSignal): Promise<VerseLookup> {
  const reference = formatReference(displayBook(passage.book), passage.chapter, passage.verseStart, passage.verseEnd);

  let response: Response;
  try {
    response = await fetch(
      `https://bible-api.com/${encodeURIComponent(reference)}?translation=${passage.translation}`,
      { signal },
    );
  } catch (e) {
    if (signal?.aborted) throw e;
    throw new Error('Check your internet connection and try again.');
  }
  if (!response.ok) throw new Error('The Bible text is unavailable right now. Try again in a moment.');

  const body: { text?: string } = await response.json();
  const text = body.text?.replace(/\s+/g, ' ').trim();
  if (!text) throw new Error('The Bible text is unavailable right now. Try again in a moment.');
  return { reference, text };
}
