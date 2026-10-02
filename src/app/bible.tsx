import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { Body, Button, Card, Chip, ErrorText, Heading, Loading, Screen, TextField, useAccentText } from '@/components/ui';
import { VerseNoteSheet } from '@/components/verse-note-sheet';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemePreference } from '@/lib/theme-preference';
import { useLanguage } from '@/i18n/language-preference';
import { lookUpChapter } from '@/lib/bible';
import { bookLabel } from '@/lib/bible-book-label';
import { useChapterNotes } from '@/lib/bible-notes';
import { BIBLE_BOOKS, formatReference } from '@/lib/bible-books';
import { creditFor, defaultVersionFor, isIndianVersion, languageOf, versionsFor, type BibleVersionCode } from '@/lib/bible-versions';

// A simple reader open to everyone: pick a version, a book and a chapter, then read.
// Tap a verse to keep a private note on it.
export default function BibleScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { scheme } = useThemePreference();
  const accent = useAccentText();
  const { bibleLanguage } = useLanguage();
  // The version the person picked here, remembered with the Bible language it was picked under, so
  // changing the Bible language in the settings goes back to that language's own version.
  const [picked, setPicked] = useState<{ language: string; code: BibleVersionCode } | null>(null);
  const version = picked?.language === bibleLanguage ? picked.code : defaultVersionFor(bibleLanguage);
  const setVersion = (code: BibleVersionCode) => setPicked({ language: bibleLanguage, code });

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
  // Book names follow the language of the version being read.
  const readingLanguage = languageOf(version);
  const label = (name: string) => bookLabel(name, readingLanguage);

  const text = useQuery({
    queryKey: ['bible-chapter', version, book.name, chapter],
    staleTime: Infinity,
    retry: false,
    queryFn: ({ signal }) => lookUpChapter(version, book.name, chapter, signal),
  });

  const notes = useChapterNotes(book.name, chapter);
  const noted = notes.data;
  const openVerse = noteVerse === null ? undefined : text.data?.verses.find((v) => v.number === noteVerse);
  const credit = creditFor(version);

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

  // People can type a book's name in the language they read, or in English.
  const query = filter.trim().toLowerCase();
  const books = BIBLE_BOOKS.map((b, index) => ({ b, index })).filter(
    ({ b }) => !query || b.name.toLowerCase().includes(query) || label(b.name).toLowerCase().includes(query),
  );

  return (
    <Screen edges={['bottom']}>
      <View style={styles.row}>
        {versionsFor(bibleLanguage).map((v) => (
          <Chip key={v.code} label={v.short} wide selected={v.code === version} onPress={() => setVersion(v.code)} />
        ))}
      </View>

      <View style={styles.row}>
        <Chip label={label(book.name)} selected={picking === 'book'} onPress={() => setPicking(picking === 'book' ? null : 'book')} />
        <Chip
          label={t('bible.chapter', { number: chapter })}
          selected={picking === 'chapter'}
          onPress={() => setPicking(picking === 'chapter' ? null : 'chapter')}
        />
      </View>

      {picking === 'book' ? (
        <View style={styles.gap}>
          <TextField
            label={t('bible.findBook')}
            value={filter}
            onChangeText={setFilter}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder={t('bible.findBookPlaceholder')}
          />
          <View style={styles.row}>
            {books.map(({ b, index }) => (
              <Chip
                key={b.name}
                label={label(b.name)}
                selected={index === bookIndex}
                onPress={() => {
                  setFilter('');
                  go(index, 1);
                }}
              />
            ))}
            {books.length === 0 ? <Body muted>{t('bible.noBook')}</Body> : null}
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
        <Heading>{`${label(book.name)} ${chapter}`}</Heading>
        {text.isPending ? <Loading /> : null}
        {text.isError ? (
          <>
            <ErrorText>{text.error.message}</ErrorText>
            {isIndianVersion(version) ? <Button title={t('bible.tryEnglish')} variant="secondary" onPress={() => setVersion('web')} /> : null}
          </>
        ) : null}
        {text.data ? (
          <>
            <Body muted>{t('bible.tapVerse')}</Body>
            <Text style={[styles.passage, { color: theme.text }]}>
              {text.data.verses.map((v) => {
                const hasNote = !!noted?.has(v.number);
                return (
                  <Text
                    key={v.number}
                    onPress={() => setNoteVerse(v.number)}
                    accessibilityRole="button"
                    accessibilityLabel={t(hasNote ? 'bible.editNoteOn' : 'bible.addNoteTo', { number: v.number })}>
                    <Text style={[styles.number, { color: hasNote ? accent : theme.textSecondary }]}>
                      {hasNote ? `${v.number}✎ ` : `${v.number} `}
                    </Text>
                    <Text style={hasNote ? { backgroundColor: scheme === 'dark' ? '#3D3510' : '#FFF4C2' } : undefined}>{v.text}</Text>{' '}
                  </Text>
                );
              })}
            </Text>
            {credit ? <Body muted>{credit}</Body> : null}
          </>
        ) : null}
      </Card>

      {openVerse ? (
        <VerseNoteSheet
          key={openVerse.number}
          reference={formatReference(label(book.name), chapter, openVerse.number, openVerse.number)}
          verseText={openVerse.text}
          book={book.name}
          chapter={chapter}
          verse={openVerse.number}
          existing={noted?.get(openVerse.number) ?? null}
          onClose={() => setNoteVerse(null)}
        />
      ) : null}

      <View style={styles.row}>
        {hasPrevious ? <Button title={t('bible.previous')} variant="secondary" onPress={previous} /> : null}
        {hasNext ? <Button title={t('bible.next')} onPress={next} /> : null}
      </View>
      <Button title={t('bible.myNotes')} variant="secondary" onPress={() => router.push('/bible-notes')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  gap: { gap: Spacing.two },
  // Taller than English needs, so the marks above and below Indian letters are not clipped.
  passage: { fontSize: 19, lineHeight: 31 },
  number: { fontSize: 12, fontWeight: 700 },
});
