import { BOOK_FOLDERS } from './bible-book-names';
import { displayBook } from './bible-books';

/** The folder that holds a book in a language's Bible text, or undefined when the language has none (English). */
export function bookFolder(book: string, language: string): string | undefined {
  return BOOK_FOLDERS[language]?.[book];
}

/**
 * A book's name as people read it in a language: "1 इतिहास" for 1 Chronicles in Hindi, "Psalm" for Psalms
 * in English. Books are always stored and matched by their English name; this is only for showing them.
 */
export function bookLabel(book: string, language: string): string {
  const folder = bookFolder(book, language);
  // The dataset writes "1इतिहास"; a space after the number reads better.
  return folder ? folder.replace(/^(\d)(?=\D)/, '$1 ') : displayBook(book);
}
