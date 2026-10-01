import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { passageFields, passageFromSaved, ScriptureField } from '@/components/scripture-field';
import { Body, Button, Card, ErrorText, Gap, Heading, Loading, Screen, TextField } from '@/components/ui';
import type { PassageDraft } from '@/components/verse-picker';
import { useActiveChurch, usePermissions } from '@/lib/church';
import type { SermonDetail } from '@/lib/database.types';
import { useEditSubmission, useSermon, useSubmitSermon } from '@/lib/sermons';
import { friendlyError } from '@/lib/supabase';

const MAX_TEXT = 8000;

// A member writes an article or short sermon for the church. It goes to the Pastor, and once the Pastor
// approves it every member can read it in Sermons under Members. With ?id= the author edits their own.
export default function SermonWriteScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { church_id } = useActiveChurch();
  const sermon = useSermon(church_id, id);

  if (id && sermon.isPending) return <Loading />;
  if (id && (!sermon.data || !sermon.data.is_mine || sermon.data.source !== 'member')) {
    return (
      <Screen edges={['bottom']}>
        <Body muted>You can only change an article you wrote.</Body>
      </Screen>
    );
  }
  return <ArticleForm existing={sermon.data ?? null} />;
}

function ArticleForm({ existing }: { existing: SermonDetail | null }) {
  const { church_id } = useActiveChurch();
  const { isPastor } = usePermissions();
  const submit = useSubmitSermon(church_id);
  const edit = useEditSubmission(church_id);

  const [title, setTitle] = useState(existing?.title ?? '');
  const [passage, setPassage] = useState<PassageDraft | null>(() =>
    passageFromSaved(existing?.book ?? null, existing?.chapter ?? null, existing?.verse_start ?? null, existing?.verse_end ?? null),
  );
  const [text, setText] = useState(existing?.body ?? '');
  const [error, setError] = useState<string | null>(null);

  const busy = submit.isPending || edit.isPending;
  const canSend = title.trim() !== '' && text.trim() !== '';

  async function onSend() {
    setError(null);
    const input = {
      title: title.trim(),
      speaker: '',
      ...passageFields(passage),
      body: text.trim(),
      url: null,
    };
    try {
      if (existing) await edit.mutateAsync({ id: existing.id, input });
      else await submit.mutateAsync({ source: 'member', input });
      router.back();
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  return (
    <Screen edges={['bottom']}>
      <ErrorText>{error}</ErrorText>

      <Card>
        <Heading>{existing ? 'Edit your article' : 'Write for the Lord’s kingdom'}</Heading>
        <Body muted>
          {isPastor
            ? 'As Pastor, this is published straight away.'
            : existing
              ? 'Saving your changes sends it back to the Pastor for another review. Until it is approved, only you and the Pastor can read it.'
              : 'Write an article or a short sermon. The Pastor reads it first. Once approved, every member can read it under Sermons, with your name as the author.'}
        </Body>
        <TextField label="Title" value={title} onChangeText={setTitle} maxLength={150} />
      </Card>

      <Card>
        <Heading>Scripture (optional)</Heading>
        <ScriptureField value={passage} onChange={setPassage} />
      </Card>

      <Card>
        <TextField
          label="Your writing"
          value={text}
          onChangeText={setText}
          multiline
          maxLength={MAX_TEXT}
          style={{ minHeight: 260, paddingTop: 12, textAlignVertical: 'top' }}
          hint={`${text.length} of ${MAX_TEXT} characters. Please write your own words, not text copied from elsewhere.`}
        />
      </Card>

      <Button title={existing ? 'Save and send for review' : isPastor ? 'Publish' : 'Send to the Pastor'} onPress={onSend} loading={busy} disabled={!canSend} />
      <Gap />
    </Screen>
  );
}
