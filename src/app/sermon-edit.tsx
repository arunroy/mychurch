import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { church_id } = useActiveChurch();
  const { isPastor } = usePermissions();
  const sermon = useSermon(church_id, id);

  if (!isPastor) {
    return (
      <Screen edges={['bottom']}>
        <Body muted>{t('sermonEdit.onlyPastor')}</Body>
      </Screen>
    );
  }
  if (id && sermon.isPending) return <Loading />;
  if (id && !sermon.data) {
    return (
      <Screen edges={['bottom']}>
        <Body muted>{t('sermon.gone')}</Body>
      </Screen>
    );
  }
  return <SermonForm existing={sermon.data ?? null} />;
}

function SermonForm({ existing }: { existing: SermonDetail | null }) {
  const { t } = useTranslation();
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
        <Heading>{t('sermonEdit.sermon')}</Heading>
        <TextField label={t('common.title')} value={title} onChangeText={setTitle} maxLength={150} />
        <TextField label={t('sermonEdit.speaker')} value={speaker} onChangeText={setSpeaker} maxLength={100} autoCapitalize="words" />
        <DateField label={t('study.date')} value={dateText} onChange={setDateText} hint={dateOk ? formatDay(dateText) : t('sermonEdit.chooseDate')} />
      </Card>

      <Card>
        <Heading>{t('sermonWrite.scripture')}</Heading>
        <ScriptureField value={passage} onChange={setPassage} />
      </Card>

      <Card>
        <Heading>{t('sermonEdit.textTitle')}</Heading>
        <TextField
          label={t('sermonEdit.writeOrPaste')}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={MAX_TEXT}
          style={{ minHeight: 180, paddingTop: 12, textAlignVertical: 'top' }}
          hint={t('sermonEdit.textHint', { count: text.length, max: MAX_TEXT })}
        />
      </Card>

      <Card>
        <Heading>{t('sermonEdit.linksTitle')}</Heading>
        <Body muted>{t('sermonEdit.linksIntro')}</Body>
        <TextField
          label={t('sermonEdit.readLink')}
          value={readUrl}
          onChangeText={setReadUrl}
          placeholder="https://"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          maxLength={500}
          hint={readBad ? t('sermonSuggest.linkBad') : undefined}
        />
        <TextField
          label={t('sermonEdit.mediaLink')}
          value={mediaUrl}
          onChangeText={setMediaUrl}
          placeholder="https://"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          maxLength={500}
          hint={mediaBad ? t('sermonSuggest.linkBad') : undefined}
        />
        {!hasContent ? <Body muted>{t('sermonEdit.addContent')}</Body> : null}
      </Card>

      <Card>
        <ToggleRow
          title={t('sermonEdit.published')}
          subtitle={published ? t('sermonEdit.publishedOn') : t('sermonEdit.publishedOff')}
          value={published}
          onValueChange={setPublished}
        />
      </Card>

      <Button title={existing ? t('notes.saveChanges') : t('sermons.addSermon')} onPress={onSave} loading={save.isPending} disabled={!canSave} />
      <Gap />
    </Screen>
  );
}
