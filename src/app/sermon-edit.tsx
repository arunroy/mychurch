import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { DateField } from '@/components/date-time-fields';
import { passageFields, passageFromSaved, ScriptureField } from '@/components/scripture-field';
import { Body, Button, Card, ErrorText, Gap, Heading, Loading, Screen, TextField, ToggleRow } from '@/components/ui';
import type { PassageDraft } from '@/components/verse-picker';
import { useUserId } from '@/lib/auth';
import { useActiveChurch, usePermissions } from '@/lib/church';
import { dateKey, formatDay, isValidDateKey } from '@/lib/dates';
import type { SermonDetail } from '@/lib/database.types';
import { isWebLink, useSaveSermon, useSermon } from '@/lib/sermons';
import { friendlyError } from '@/lib/supabase';

const MAX_TEXT = 8000;

// Adds one of the Pastor's own sermons, or with ?id= edits one. Only the Pastor; the database enforces that too.
// Members write articles and suggest outside sermons through their own screens, which go to the Pastor for review.
export default function SermonEditScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { church_id } = useActiveChurch();
  const { isPastor } = usePermissions();
  const sermon = useSermon(church_id, id);

  if (!isPastor) {
    return (
      <Screen edges={['bottom']}>
        <Body muted>Only the Pastor can add or change the church&apos;s own sermons.</Body>
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

function SermonForm({ existing }: { existing: SermonDetail | null }) {
  const { church_id } = useActiveChurch();
  const userId = useUserId();
  const save = useSaveSermon(church_id, userId!);

  const [title, setTitle] = useState(existing?.title ?? '');
  const [speaker, setSpeaker] = useState(existing?.speaker ?? '');
  const [dateText, setDateText] = useState(existing?.sermon_date ?? dateKey());
  const [passage, setPassage] = useState<PassageDraft | null>(() =>
    passageFromSaved(existing?.book ?? null, existing?.chapter ?? null, existing?.verse_start ?? null, existing?.verse_end ?? null),
  );
  const [text, setText] = useState(existing?.body ?? '');
  const [readUrl, setReadUrl] = useState(existing?.read_url ?? '');
  const [mediaUrl, setMediaUrl] = useState(existing?.media_url ?? '');
  const [published, setPublished] = useState(existing?.published ?? true);
  const [error, setError] = useState<string | null>(null);

  const dateOk = isValidDateKey(dateText);
  const body = text.trim();
  const read = readUrl.trim();
  const media = mediaUrl.trim();
  const readBad = read !== '' && !isWebLink(read);
  const mediaBad = media !== '' && !isWebLink(media);
  const hasContent = body !== '' || read !== '' || media !== '';
  const canSave = title.trim() !== '' && dateOk && hasContent && !readBad && !mediaBad;

  async function onSave() {
    setError(null);
    try {
      await save.mutateAsync({
        id: existing?.id,
        input: {
          title: title.trim(),
          speaker: speaker.trim(),
          sermon_date: dateText,
          ...passageFields(passage),
          body: body || null,
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
        <ScriptureField value={passage} onChange={setPassage} />
      </Card>

      <Card>
        <Heading>Sermon text (optional)</Heading>
        <TextField
          label="Write or paste your own sermon"
          value={text}
          onChangeText={setText}
          multiline
          maxLength={MAX_TEXT}
          style={{ minHeight: 180, paddingTop: 12, textAlignVertical: 'top' }}
          hint={`${text.length} of ${MAX_TEXT} characters. Only add text you wrote or have permission to share.`}
        />
      </Card>

      <Card>
        <Heading>Links (optional)</Heading>
        <Body muted>A link to read the sermon elsewhere, and/or a video or audio link. Members tap through to open them.</Body>
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
        {!hasContent ? <Body muted>Add the sermon text, a link, or both.</Body> : null}
      </Card>

      <Card>
        <ToggleRow
          title="Published"
          subtitle={published ? 'Everyone in the church can see this sermon.' : 'A draft: only you can see it.'}
          value={published}
          onValueChange={setPublished}
        />
      </Card>

      <Button title={existing ? 'Save changes' : 'Add sermon'} onPress={onSave} loading={save.isPending} disabled={!canSave} />
      <Gap />
    </Screen>
  );
}
