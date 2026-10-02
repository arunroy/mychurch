import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Body, Button, Card, ErrorText, Heading, TextField } from '@/components/ui';
import { useActiveChurch, useChurch } from '@/lib/church';
import { confirm } from '@/lib/confirm';
import { friendlyError } from '@/lib/supabase';
import { useSetYoutubeChannel } from '@/lib/videos';

/**
 * The church's YouTube channel, in the church settings. The server works out which channel the link is
 * and checks it before saving, so a mistyped link is explained here instead of silently saved.
 */
export function YoutubeChannelCard() {
  const { t } = useTranslation();
  const { church } = useActiveChurch();
  const { refresh } = useChurch();
  const save = useSetYoutubeChannel(church.id);
  const [link, setLink] = useState(church.youtube_url ?? '');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const saved = church.youtube_url ?? '';
  const changed = link.trim() !== saved;

  async function onSave(next: string) {
    setError(null);
    setMessage(null);
    try {
      const result = await save.mutateAsync(next);
      await refresh();
      if (result.removed) {
        setLink('');
        setMessage(t('settings.youtubeRemoved'));
      } else {
        setMessage(t('settings.youtubeSaved', { channel: result.channel_title ?? '' }));
      }
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  function onRemove() {
    confirm(t('settings.youtubeRemoveTitle'), t('settings.youtubeRemoveMessage'), t('common.remove'), () => onSave(''));
  }

  return (
    <Card>
      <Heading>{t('settings.youtubeTitle')}</Heading>
      <Body muted>{t('settings.youtubeIntro')}</Body>
      <TextField
        label={t('settings.youtubeLink')}
        value={link}
        onChangeText={(text) => {
          setLink(text);
          setMessage(null);
        }}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        maxLength={300}
        placeholder="youtube.com/@yourchurch"
        hint={t('settings.youtubeHint')}
      />
      <ErrorText>{error}</ErrorText>
      {message ? <Body>{message}</Body> : null}
      <Button
        title={t('settings.youtubeSave')}
        onPress={() => onSave(link.trim())}
        loading={save.isPending}
        disabled={!changed || link.trim() === ''}
      />
      {saved ? <Button title={t('settings.youtubeRemove')} variant="secondary" onPress={onRemove} disabled={save.isPending} /> : null}
    </Card>
  );
}
