import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Body, Button, Card, ErrorText, Gap, Heading, Loading, Screen, TextField } from '@/components/ui';
import { useActiveChurch, usePermissions } from '@/lib/church';
import type { SermonDetail } from '@/lib/database.types';
import { isWebLink, useEditSubmission, useSermon, useSubmitSermon } from '@/lib/sermons';
import { friendlyError } from '@/lib/supabase';

// Anyone can share a link to an outside sermon they found worth the church's time. It goes to the Pastor, and only
// after approval do members see it, under External. The app keeps just the link and a note, never the sermon's text.
export default function SermonSuggestScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { church_id } = useActiveChurch();
  const sermon = useSermon(church_id, id);

  if (id && sermon.isPending) return <Loading />;
  if (id && (!sermon.data || !sermon.data.is_mine || sermon.data.source !== 'external')) {
    return (
      <Screen edges={['bottom']}>
        <Body muted>{t('sermonSuggest.onlyOwn')}</Body>
      </Screen>
    );
  }
  return <SuggestForm existing={sermon.data ?? null} />;
}

function SuggestForm({ existing }: { existing: SermonDetail | null }) {
  const { t } = useTranslation();
  const { church_id } = useActiveChurch();
  const { isPastor } = usePermissions();
  const submit = useSubmitSermon(church_id);
  const edit = useEditSubmission(church_id);

  const [title, setTitle] = useState(existing?.title ?? '');
  const [speaker, setSpeaker] = useState(existing?.speaker ?? '');
  const [url, setUrl] = useState(existing?.read_url ?? '');
  const [note, setNote] = useState(existing?.body ?? '');
  const [error, setError] = useState<string | null>(null);

  const link = url.trim();
  const linkBad = link !== '' && !isWebLink(link);
  const busy = submit.isPending || edit.isPending;
  const canSend = title.trim() !== '' && link !== '' && !linkBad;

  async function onSend() {
    setError(null);
    const input = {
      title: title.trim(),
      speaker: speaker.trim(),
      reference: '',
      book: null,
      chapter: null,
      verse_start: null,
      verse_end: null,
      body: note.trim() || null,
      url: link,
    };
    try {
      if (existing) await edit.mutateAsync({ id: existing.id, input });
      else await submit.mutateAsync({ source: 'external', input });
      router.back();
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  return (
    <Screen edges={['bottom']}>
      <ErrorText>{error}</ErrorText>

      <Card>
        <Heading>{existing ? t('sermonSuggest.editTitle') : t('sermons.shareOutside')}</Heading>
        <Body muted>{isPastor ? t('sermonWrite.pastorPublished') : existing ? t('sermonSuggest.resend') : t('sermonSuggest.intro')}</Body>
        <TextField label={t('common.title')} value={title} onChangeText={setTitle} maxLength={150} />
        <TextField label={t('sermonSuggest.who')} value={speaker} onChangeText={setSpeaker} maxLength={100} autoCapitalize="words" />
        <TextField
          label={t('sermonSuggest.link')}
          value={url}
          onChangeText={setUrl}
          placeholder="https://"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          maxLength={500}
          hint={linkBad ? t('sermonSuggest.linkBad') : t('sermonSuggest.linkHint')}
        />
        <TextField
          label={t('sermonSuggest.why')}
          value={note}
          onChangeText={setNote}
          multiline
          maxLength={500}
          style={{ minHeight: 90, paddingTop: 12, textAlignVertical: 'top' }}
          hint={t('sermonSuggest.whyHint')}
        />
      </Card>

      <Button title={existing ? t('sermonWrite.saveSend') : isPastor ? t('sermonWrite.publish') : t('notes.send')} onPress={onSend} loading={busy} disabled={!canSend} />
      <Gap />
    </Screen>
  );
}
