import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Body, Button, Card, ErrorText, Gap, Heading, Screen, TextField, Row, Checkmark } from '@/components/ui';
import { useActiveChurch } from '@/lib/church';
import type { PrayerVisibility } from '@/lib/database.types';
import { useShareRequest, VISIBILITY_CHOICES } from '@/lib/prayers';
import { friendlyError } from '@/lib/supabase';

// Any member can share a prayer request and choose who sees it.
export default function PrayerNewScreen() {
  const { t } = useTranslation();
  const { church_id } = useActiveChurch();
  const share = useShareRequest(church_id);
  const [body, setBody] = useState('');
  const [visibility, setVisibility] = useState<PrayerVisibility>('church');
  const [error, setError] = useState<string | null>(null);

  async function onShare() {
    setError(null);
    try {
      await share.mutateAsync({ body: body.trim(), visibility });
      router.back();
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  return (
    <Screen edges={['bottom']}>
      <ErrorText>{error}</ErrorText>

      <Card>
        <Heading>{t('prayerNew.yourRequest')}</Heading>
        <TextField
          label={t('prayerNew.howPray')}
          value={body}
          onChangeText={setBody}
          multiline
          maxLength={1000}
          style={{ minHeight: 140, paddingTop: 12, textAlignVertical: 'top' }}
        />
      </Card>

      <Card>
        <Heading>{t('prayerNew.whoSee')}</Heading>
        {VISIBILITY_CHOICES.map((choice) => (
          <Row
            key={choice.value}
            title={t(`prayerNew.choice${choice.value[0].toUpperCase()}${choice.value.slice(1)}`)}
            right={<Checkmark visible={choice.value === visibility} />}
            chevron={false}
            onPress={() => setVisibility(choice.value)}
          />
        ))}
      </Card>
      <Body muted>{t(`prayerNew.hint${visibility[0].toUpperCase()}${visibility.slice(1)}`)}</Body>
      <Body muted>{t('prayerNew.nameShown')}</Body>

      <Button title={t('prayerNew.shareButton')} onPress={onShare} loading={share.isPending} disabled={!body.trim()} />
      <Gap />
    </Screen>
  );
}

