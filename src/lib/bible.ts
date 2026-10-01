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
