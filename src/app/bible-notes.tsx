import { router } from 'expo-router';

import { Body, Card, ErrorText, Loading, Row, Screen } from '@/components/ui';
import { useAllNotes } from '@/lib/bible-notes';
import { displayBook, formatReference } from '@/lib/bible-books';
import { friendlyError } from '@/lib/supabase';

// Every note the person has written. Tapping one opens the chapter in the reader.
export default function BibleNotesScreen() {
  const notes = useAllNotes();

  return (
    <Screen edges={['bottom']}>
      <Body muted>Your private notes on Bible verses. Only you can see them.</Body>
      <ErrorText>{notes.error ? friendlyError(notes.error) : null}</ErrorText>
      {notes.isPending ? <Loading /> : null}
      {notes.data?.length === 0 ? <Body>No notes yet. While you read, tap a verse to add one.</Body> : null}
      {notes.data?.length ? (
        <Card>
          {notes.data.map((note) => (
            <Row
              key={note.id}
              title={formatReference(displayBook(note.book), note.chapter, note.verse, note.verse)}
              subtitle={note.body}
              onPress={() => router.push({ pathname: '/bible', params: { book: note.book, chapter: String(note.chapter) } })}
            />
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}
