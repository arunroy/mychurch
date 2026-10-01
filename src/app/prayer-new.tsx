import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Card, Chip, ErrorText, Gap, Heading, Screen, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useActiveChurch } from '@/lib/church';
import type { PrayerVisibility } from '@/lib/database.types';
import { useShareRequest, VISIBILITY_CHOICES } from '@/lib/prayers';
import { friendlyError } from '@/lib/supabase';

// Any member can share a prayer request and choose who sees it.
export default function PrayerNewScreen() {
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
        <Heading>Your request</Heading>
        <TextField
          label="How can the church pray for you?"
          value={body}
          onChangeText={setBody}
          multiline
          maxLength={1000}
          style={{ minHeight: 140, paddingTop: 12, textAlignVertical: 'top' }}
        />
      </Card>

      <Card>
        <Heading>Who can see it</Heading>
        <View style={styles.chips}>
          {VISIBILITY_CHOICES.map((choice) => (
            <Chip key={choice.value} label={choice.label} selected={choice.value === visibility} onPress={() => setVisibility(choice.value)} />
          ))}
        </View>
        <Body muted>{VISIBILITY_CHOICES.find((c) => c.value === visibility)?.hint}</Body>
        <Body muted>Your name is shown with your request.</Body>
      </Card>

      <Button title="Share request" onPress={onShare} loading={share.isPending} disabled={!body.trim()} />
      <Gap />
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
