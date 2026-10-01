import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Body, Button, Card, Chip, ErrorText, Heading, Loading, Screen, TextField, useAccentText } from '@/components/ui';
import { VerseNoteSheet } from '@/components/verse-note-sheet';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { lookUpChapter } from '@/lib/bible';
import { useChapterNotes } from '@/lib/bible-notes';
import { BIBLE_BOOKS, displayBook, formatReference, TRANSLATIONS, type TranslationCode } from '@/lib/bible-books';

// A simple reader open to everyone: pick a translation, a book and a chapter, then read.
// Tap a verse to keep a private note on it.
export default function BibleScreen() {
  const theme = useTheme();
  const accent = useAccentText();
  const [translation, setTranslation] = useState<TranslationCode>('web');
  // Study screens and the notes list can open the reader at a book and chapter; otherwise it starts at John 1.
  const params = useLocalSearchParams<{ book?: string; chapter?: string }>();
  const startBook = BIBLE_BOOKS.findIndex((b) => b.name === params.book);
  const startChapter = Number(params.chapter);
  const [bookIndex, setBookIndex] = useState(startBook >= 0 ? startBook : 42);
  const [chapter, setChapter] = useState(
    startBook >= 0 && Number.isInteger(startChapter) && startChapter >= 1 && startChapter <= BIBLE_BOOKS[startBook].verses.length
      ? startChapter
      : 1,
  );
  const [noteVerse, setNoteVerse] = useState<number | null>(null);
  const [picking, setPicking] = useState<'book' | 'chapter' | null>(null);
  const [filter, setFilter] = useState('');

  const book = BIBLE_BOOKS[bookIndex];
  const text = useQuery({
    queryKey: ['bible-chapter', translation, book.name, chapter],
    staleTime: Infinity,
    retry: false,
    queryFn: ({ signal }) => lookUpChapter(translation, book.name, chapter, signal),
  });

  const notes = useChapterNotes(book.name, chapter);
  const noted = notes.data;
  const openVerse = noteVerse === null ? undefined : text.data?.verses.find((v) => v.number === noteVerse);

  const hasPrevious = chapter > 1 || bookIndex > 0;
  const hasNext = chapter < book.verses.length || bookIndex < BIBLE_BOOKS.length - 1;

  function go(nextBook: number, nextChapter: number) {
    setBookIndex(nextBook);
    setChapter(nextChapter);
    setPicking(null);
    setNoteVerse(null);
  }
  function previous() {
    if (chapter > 1) go(bookIndex, chapter - 1);
    else go(bookIndex - 1, BIBLE_BOOKS[bookIndex - 1].verses.length);
  }
  function next() {
    if (chapter < book.verses.length) go(bookIndex, chapter + 1);
    else go(bookIndex + 1, 1);
  }

  const books = BIBLE_BOOKS.map((b, index) => ({ b, index })).filter(({ b }) =>
    b.name.toLowerCase().includes(filter.trim().toLowerCase()),
  );

  return (
    <Screen edges={['bottom']}>
      <View style={styles.row}>
        {TRANSLATIONS.map((t) => (
          <Chip key={t.code} label={t.short} wide selected={t.code === translation} onPress={() => setTranslation(t.code)} />
        ))}
      </View>

      <View style={styles.row}>
        <Chip label={displayBook(book.name)} selected={picking === 'book'} onPress={() => setPicking(picking === 'book' ? null : 'book')} />
        <Chip label={`Chapter ${chapter}`} selected={picking === 'chapter'} onPress={() => setPicking(picking === 'chapter' ? null : 'chapter')} />
      </View>

      {picking === 'book' ? (
        <View style={styles.gap}>
          <TextField
            label="Find a book"
            value={filter}
            onChangeText={setFilter}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="Start typing, like Rom"
          />
          <View style={styles.row}>
            {books.map(({ b, index }) => (
              <Chip
                key={b.name}
                label={b.name}
                selected={index === bookIndex}
                onPress={() => {
                  setFilter('');
                  go(index, 1);
                }}
              />
            ))}
            {books.length === 0 ? <Body muted>No book matches that.</Body> : null}
          </View>
        </View>
      ) : null}

      {picking === 'chapter' ? (
        <View style={styles.row}>
          {book.verses.map((_, i) => (
            <Chip key={i} label={String(i + 1)} selected={i + 1 === chapter} onPress={() => go(bookIndex, i + 1)} />
          ))}
        </View>
      ) : null}

      <Card>
        <Heading>{`${displayBook(book.name)} ${chapter}`}</Heading>
        {text.isPending ? <Loading /> : null}
        {text.isError ? <ErrorText>{text.error.message}</ErrorText> : null}
        {text.data ? (
          <>
            <Body muted>Tap a verse to add a note. Verses with a note are marked ✎.</Body>
            <Text style={[styles.passage, { color: theme.text }]}>
              {text.data.verses.map((v) => {
                const hasNote = !!noted?.has(v.number);
                return (
                  <Text
                    key={v.number}
                    onPress={() => setNoteVerse(v.number)}
                    accessibilityRole="button"
                    accessibilityLabel={`${hasNote ? 'Edit note on' : 'Add a note to'} verse ${v.number}`}>
                    <Text style={[styles.number, { color: hasNote ? accent : theme.textSecondary }]}>
                      {hasNote ? `${v.number}✎ ` : `${v.number} `}
                    </Text>
                    <Text style={hasNote ? { backgroundColor: theme.backgroundSelected } : undefined}>{v.text}</Text>{' '}
                  </Text>
                );
              })}
            </Text>
          </>
        ) : null}
      </Card>

      {openVerse ? (
        <VerseNoteSheet
          key={openVerse.number}
          reference={formatReference(displayBook(book.name), chapter, openVerse.number, openVerse.number)}
          verseText={openVerse.text}
          book={book.name}
          chapter={chapter}
          verse={openVerse.number}
          existing={noted?.get(openVerse.number) ?? null}
          onClose={() => setNoteVerse(null)}
        />
      ) : null}

      <View style={styles.row}>
        {hasPrevious ? <Button title="Previous" variant="secondary" onPress={previous} /> : null}
        {hasNext ? <Button title="Next" onPress={next} /> : null}
      </View>
      <Button title="My notes" variant="secondary" onPress={() => router.push('/bible-notes')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  gap: { gap: Spacing.two },
  passage: { fontSize: 18, lineHeight: 28 },
  number: { fontSize: 12, fontWeight: 600 },
});
