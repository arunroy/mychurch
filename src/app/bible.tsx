import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Body, Button, Card, Chip, ErrorText, Heading, Loading, Screen, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { lookUpChapter } from '@/lib/bible';
import { BIBLE_BOOKS, displayBook, TRANSLATIONS, type TranslationCode } from '@/lib/bible-books';

// A simple reader open to everyone: pick a translation, a book and a chapter, then read.
export default function BibleScreen() {
  const theme = useTheme();
  const [translation, setTranslation] = useState<TranslationCode>('web');
  const [bookIndex, setBookIndex] = useState(42); // John
  const [chapter, setChapter] = useState(1);
  const [picking, setPicking] = useState<'book' | 'chapter' | null>(null);
  const [filter, setFilter] = useState('');

  const book = BIBLE_BOOKS[bookIndex];
  const text = useQuery({
    queryKey: ['bible-chapter', translation, book.name, chapter],
    staleTime: Infinity,
    retry: false,
    queryFn: ({ signal }) => lookUpChapter(translation, book.name, chapter, signal),
  });

  const hasPrevious = chapter > 1 || bookIndex > 0;
  const hasNext = chapter < book.verses.length || bookIndex < BIBLE_BOOKS.length - 1;

  function go(nextBook: number, nextChapter: number) {
    setBookIndex(nextBook);
    setChapter(nextChapter);
    setPicking(null);
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
          <Text style={[styles.passage, { color: theme.text }]} selectable>
            {text.data.verses.map((v) => (
              <Text key={v.number}>
                <Text style={[styles.number, { color: theme.textSecondary }]}>{v.number} </Text>
                {v.text}{' '}
              </Text>
            ))}
          </Text>
        ) : null}
      </Card>

      <View style={styles.row}>
        {hasPrevious ? <Button title="Previous" variant="secondary" onPress={previous} /> : null}
        {hasNext ? <Button title="Next" onPress={next} /> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  gap: { gap: Spacing.two },
  passage: { fontSize: 18, lineHeight: 28 },
  number: { fontSize: 12, fontWeight: 600 },
});
