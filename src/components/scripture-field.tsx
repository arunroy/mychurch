import { Body, Button } from '@/components/ui';
import { VersePicker, type PassageDraft } from '@/components/verse-picker';
import { displayBook, findBook, formatReference } from '@/lib/bible-books';

/** The saved parts of a passage as a draft for the picker, or null when none was chosen. */
export function passageFromSaved(
  book: string | null,
  chapter: number | null,
  verseStart: number | null,
  verseEnd: number | null,
): PassageDraft | null {
  if (book && findBook(book) && chapter && verseStart) {
    return { translation: 'web', book, chapter, verseStart, verseEnd: verseEnd ?? verseStart };
  }
  return null;
}

/** The pieces to store for a chosen passage, or empty ones when nothing is chosen yet. */
export function passageFields(passage: PassageDraft | null) {
  if (!passage?.book) {
    return { reference: '', book: null, chapter: null, verse_start: null, verse_end: null };
  }
  return {
    reference: formatReference(displayBook(passage.book), passage.chapter, passage.verseStart, passage.verseEnd),
    book: passage.book,
    chapter: passage.chapter,
    verse_start: passage.verseStart,
    verse_end: passage.verseEnd,
  };
}

/** Pick an optional main passage for a sermon: book, chapter and verses, with no translation. */
export function ScriptureField({ value, onChange }: { value: PassageDraft | null; onChange: (next: PassageDraft | null) => void }) {
  const reference = passageFields(value).reference;
  return value ? (
    <>
      <VersePicker value={value} onChange={onChange} showTranslation={false} />
      {reference ? <Body>{reference}</Body> : null}
      <Button title="Remove the passage" variant="secondary" onPress={() => onChange(null)} />
    </>
  ) : (
    <Button
      title="Choose a passage"
      variant="secondary"
      onPress={() => onChange({ translation: 'web', book: null, chapter: 1, verseStart: 1, verseEnd: 1 })}
    />
  );
}
