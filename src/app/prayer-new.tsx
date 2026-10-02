import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Card, Chip, ErrorText, Gap, Heading, Screen, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
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
        <View style={styles.chips}>
          {VISIBILITY_CHOICES.map((choice) => (
            <Chip key={choice.value} label={t(`prayerNew.choice${choice.value[0].toUpperCase()}${choice.value.slice(1)}`)} selected={choice.value === visibility} onPress={() => setVisibility(choice.value)} />
          ))}
        </View>
        <Body muted>{t(`prayerNew.hint${visibility[0].toUpperCase()}${visibility.slice(1)}`)}</Body>
        <Body muted>{t('prayerNew.nameShown')}</Body>
      </Card>

      <Button title={t('prayerNew.shareButton')} onPress={onShare} loading={share.isPending} disabled={!body.trim()} />
      <Gap />
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
