import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { DateField } from '@/components/date-time-fields';
import { Body, Button, Card, ErrorText, Gap, Heading, Loading, Screen, TextField, ToggleRow } from '@/components/ui';
import { VersePicker, type PassageDraft } from '@/components/verse-picker';
import { Spacing } from '@/constants/theme';
import { useUserId } from '@/lib/auth';
import { displayBook, findBook, formatReference } from '@/lib/bible-books';
import { useActiveChurch, usePermissions } from '@/lib/church';
import { dateKey, formatDay, isValidDateKey } from '@/lib/dates';
import type { Sermon } from '@/lib/database.types';
import { isWebLink, useSaveSermon, useSermon } from '@/lib/sermons';
import { friendlyError } from '@/lib/supabase';

// Adds a sermon, or with ?id= edits one. Leaders only; the database enforces that too.
export default function SermonEditScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { church_id } = useActiveChurch();
  const { isLeader } = usePermissions();
  const sermon = useSermon(church_id, id);

  if (!isLeader) {
    return (
      <Screen edges={['bottom']}>
        <Body muted>Only the Pastor, elders and church admins can add or change sermons.</Body>
      </Screen>
    );
  }
  if (id && sermon.isPending) return <Loading />;
  if (id && !sermon.data) {
    return (
      <Screen edges={['bottom']}>
        <Body muted>This sermon is no longer in the list.</Body>
      </Screen>
    );
  }
  return <SermonForm existing={sermon.data ?? null} />;
}

/** Starts from the saved passage. A sermon with no scripture starts with the picker closed. */
function passageFrom(existing: Sermon | null): PassageDraft | null {
  if (existing?.book && findBook(existing.book) && existing.chapter && existing.verse_start) {
    return {
      translation: 'web',
      book: existing.book,
      chapter: existing.chapter,
      verseStart: existing.verse_start,
      verseEnd: existing.verse_end ?? existing.verse_start,
    };
  }
  return null;
}

function SermonForm({ existing }: { existing: Sermon | null }) {
  const { church_id } = useActiveChurch();
  const userId = useUserId();
  const save = useSaveSermon(church_id, userId!);

  const [title, setTitle] = useState(existing?.title ?? '');
  const [speaker, setSpeaker] = useState(existing?.speaker ?? '');
  const [dateText, setDateText] = useState(existing?.sermon_date ?? dateKey());
  const [passage, setPassage] = useState<PassageDraft | null>(() => passageFrom(existing));
  const [readUrl, setReadUrl] = useState(existing?.read_url ?? '');
  const [mediaUrl, setMediaUrl] = useState(existing?.media_url ?? '');
  const [published, setPublished] = useState(existing?.published ?? true);
  const [error, setError] = useState<string | null>(null);

  const dateOk = isValidDateKey(dateText);
  const read = readUrl.trim();
  const media = mediaUrl.trim();
  const readBad = read !== '' && !isWebLink(read);
  const mediaBad = media !== '' && !isWebLink(media);
  const hasLink = read !== '' || media !== '';
  const canSave = title.trim() !== '' && dateOk && hasLink && !readBad && !mediaBad;

  const chosen = passage?.book ? passage : null;
  const reference = chosen ? formatReference(displayBook(chosen.book!), chosen.chapter, chosen.verseStart, chosen.verseEnd) : '';

  async function onSave() {
    setError(null);
    try {
      await save.mutateAsync({
        id: existing?.id,
        input: {
          title: title.trim(),
          speaker: speaker.trim(),
          sermon_date: dateText,
          reference,
          book: chosen?.book ?? null,
          chapter: chosen ? chosen.chapter : null,
          verse_start: chosen ? chosen.verseStart : null,
          verse_end: chosen ? chosen.verseEnd : null,
          read_url: read || null,
          media_url: media || null,
          published,
        },
      });
      router.back();
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  return (
    <Screen edges={['bottom']}>
      <ErrorText>{error}</ErrorText>

      <Card>
        <Heading>Sermon</Heading>
        <TextField label="Title" value={title} onChangeText={setTitle} maxLength={150} />
        <TextField label="Speaker (optional)" value={speaker} onChangeText={setSpeaker} maxLength={100} autoCapitalize="words" />
        <DateField label="Date" value={dateText} onChange={setDateText} hint={dateOk ? formatDay(dateText) : 'Choose the date.'} />
      </Card>

      <Card>
        <Heading>Scripture (optional)</Heading>
        {passage ? (
          <>
            <VersePicker value={passage} onChange={setPassage} showTranslation={false} />
            {reference ? <Body>{reference}</Body> : null}
            <Button title="Remove the passage" variant="secondary" onPress={() => setPassage(null)} />
          </>
        ) : (
          <Button
            title="Choose a passage"
            variant="secondary"
            onPress={() => setPassage({ translation: 'web', book: null, chapter: 1, verseStart: 1, verseEnd: 1 })}
          />
        )}
      </Card>

      <Card>
        <Heading>Links</Heading>
        <Body muted>
          The app doesn&apos;t keep sermon text. Add a link to where it can be read, such as its SermonCentral page, and/or a video or
          audio link. Members tap through to open them.
        </Body>
        <TextField
          label="Link to read the sermon"
          value={readUrl}
          onChangeText={setReadUrl}
          placeholder="https://"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          maxLength={500}
          hint={readBad ? 'Start the link with https://' : undefined}
        />
        <TextField
          label="Link to watch or listen"
          value={mediaUrl}
          onChangeText={setMediaUrl}
          placeholder="https://"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          maxLength={500}
          hint={mediaBad ? 'Start the link with https://' : undefined}
        />
        {!hasLink ? <Body muted>Add at least one link.</Body> : null}
      </Card>

      <Card>
        <ToggleRow
          title="Published"
          subtitle={published ? 'Everyone in the church can see this sermon.' : 'A draft: only church leaders can see it.'}
          value={published}
          onValueChange={setPublished}
        />
      </Card>

      <View style={styles.actions}>
        <Button title={existing ? 'Save changes' : 'Add sermon'} onPress={onSave} loading={save.isPending} disabled={!canSave} />
      </View>
      <Gap />
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { gap: Spacing.two },
});
