import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Body, Card, ErrorText, Loading, Row, Screen } from '@/components/ui';
import { useLanguage } from '@/i18n/language-preference';
import { bookLabel } from '@/lib/bible-book-label';
import { useAllNotes } from '@/lib/bible-notes';
import { formatReference } from '@/lib/bible-books';
import { friendlyError } from '@/lib/supabase';

// Every note the person has written. Tapping one opens the chapter in the reader.
export default function BibleNotesScreen() {
  const { t } = useTranslation();
  const { bibleLanguage } = useLanguage();
  const notes = useAllNotes();

  return (
    <Screen edges={['bottom']}>
      <Body muted>{t('notes.intro')}</Body>
      <ErrorText>{notes.error ? friendlyError(notes.error) : null}</ErrorText>
      {notes.isPending ? <Loading /> : null}
      {notes.data?.length === 0 ? <Body>{t('notes.empty')}</Body> : null}
      {notes.data?.length ? (
        <Card>
          {notes.data.map((note) => (
            <Row
              key={note.id}
              title={formatReference(bookLabel(note.book, bibleLanguage), note.chapter, note.verse, note.verse)}
              subtitle={note.body}
              onPress={() => router.push({ pathname: '/bible', params: { book: note.book, chapter: String(note.chapter) } })}
            />
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}
