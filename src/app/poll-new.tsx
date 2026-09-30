import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Card, Chip, ErrorText, Gap, Heading, Screen, TextField, ToggleRow } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useActiveChurch } from '@/lib/church';
import { endsAfter, SHORT_DURATIONS, type Duration } from '@/lib/durations';
import { useCreatePoll } from '@/lib/polls';
import { friendlyError } from '@/lib/supabase';

const MAX_OPTIONS = 10;
const DURATIONS: Duration[] = [...SHORT_DURATIONS, { label: 'Until I close it', days: null }];

// Any member can start a poll.
export default function PollNewScreen() {
  const { church_id } = useActiveChurch();
  const create = useCreatePoll(church_id);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [multiple, setMultiple] = useState(false);
  const [days, setDays] = useState<number | null>(7);
  const [error, setError] = useState<string | null>(null);

  const filled = options.map((o) => o.trim()).filter(Boolean);
  const canStart = question.trim().length > 0 && filled.length >= 2;

  function setOption(index: number, value: string) {
    setOptions((current) => current.map((o, i) => (i === index ? value : o)));
  }

  async function onStart() {
    setError(null);
    try {
      await create.mutateAsync({ question: question.trim(), options: filled, multiple, closesAt: endsAfter(days) });
      router.back();
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  return (
    <Screen edges={['bottom']}>
      <ErrorText>{error}</ErrorText>

      <Card>
        <Heading>Question</Heading>
        <TextField label="What do you want to ask?" value={question} onChangeText={setQuestion} maxLength={200} multiline />
      </Card>

      <Card>
        <Heading>Choices</Heading>
        {options.map((option, index) => (
          <View key={index} style={styles.optionRow}>
            <View style={styles.optionField}>
              <TextField label={`Choice ${index + 1}`} value={option} onChangeText={(v) => setOption(index, v)} maxLength={100} />
            </View>
            {options.length > 2 ? (
              <Button
                title="Remove"
                variant="secondary"
                style={styles.remove}
                onPress={() => setOptions((current) => current.filter((_, i) => i !== index))}
              />
            ) : null}
          </View>
        ))}
        {options.length < MAX_OPTIONS ? (
          <Button title="Add a choice" variant="secondary" onPress={() => setOptions((current) => [...current, ''])} />
        ) : null}
        <ToggleRow title="Allow more than one answer" value={multiple} onValueChange={setMultiple} />
      </Card>

      <Card>
        <Heading>Voting closes</Heading>
        <View style={styles.chips}>
          {DURATIONS.map((d) => (
            <Chip key={d.label} label={d.label} selected={d.days === days} onPress={() => setDays(d.days)} />
          ))}
        </View>
        <Body muted>Everyone in the church can vote once, and can change their vote until it closes. Votes are private.</Body>
      </Card>

      <Button title="Start the poll" onPress={onStart} loading={create.isPending} disabled={!canStart} />
      <Gap />
    </Screen>
  );
}

const styles = StyleSheet.create({
  optionRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.two },
  optionField: { flex: 1 },
  remove: { minHeight: 50 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
