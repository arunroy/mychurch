import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { DateField, TimeField } from '@/components/date-time-fields';
import { Body, Button, Card, ErrorText, Gap, Heading, Loading, Screen, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useUserId } from '@/lib/auth';
import { useActiveChurch, usePermissions } from '@/lib/church';
import {
  addDays,
  combineDateTime,
  dateKey,
  isValidDateKey,
  isValidTime,
  thisSunday,
  timeText,
} from '@/lib/dates';
import { canManageEvent, useEvent, useSaveEvent, type EventWithCreator } from '@/lib/events';
import { friendlyError } from '@/lib/supabase';

// Adds an event, or with ?id= edits one. Anyone in the church can add; only the creator or a leader can edit.
export default function EventEditScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { church_id } = useActiveChurch();
  const event = useEvent(church_id, id);

  if (id && event.isPending) return <Loading />;
  if (id && !event.data) {
    return (
      <Screen edges={['bottom']}>
        <Body muted>This event is no longer on the calendar.</Body>
      </Screen>
    );
  }
  return <EventForm existing={event.data ?? null} />;
}

function EventForm({ existing }: { existing: EventWithCreator | null }) {
  const { church_id } = useActiveChurch();
  const { isLeader } = usePermissions();
  const userId = useUserId();
  const save = useSaveEvent(church_id, userId!);

  const start = existing ? new Date(existing.starts_at) : null;
  const end = existing?.ends_at ? new Date(existing.ends_at) : null;
  const [title, setTitle] = useState(existing?.title ?? '');
  const [date, setDate] = useState(start ? dateKey(start) : '');
  const [startTime, setStartTime] = useState(start ? timeText(start) : '');
  const [endTime, setEndTime] = useState(end ? timeText(end) : '');
  const [location, setLocation] = useState(existing?.location ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [error, setError] = useState<string | null>(null);

  if (existing && !canManageEvent(existing, userId ?? undefined, isLeader)) {
    return (
      <Screen edges={['bottom']}>
        <Body muted>Only the person who added this event, or a church leader, can change it.</Body>
      </Screen>
    );
  }

  const dateOk = isValidDateKey(date);
  const startOk = isValidTime(startTime);
  const endBlank = endTime.trim() === '';
  const endOk = endBlank || isValidTime(endTime);
  const endAfterStart =
    !dateOk || !startOk || endBlank || !endOk || combineDateTime(date, endTime) > combineDateTime(date, startTime);
  const canSave = title.trim().length > 0 && dateOk && startOk && endOk && endAfterStart;

  async function onSave() {
    setError(null);
    try {
      await save.mutateAsync({
        id: existing?.id,
        input: {
          title: title.trim(),
          description: description.trim(),
          location: location.trim(),
          starts_at: combineDateTime(date, startTime).toISOString(),
          ends_at: endBlank ? null : combineDateTime(date, endTime).toISOString(),
        },
      });
      router.back();
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  const today = dateKey();
  const shortcuts = [
    { label: 'Today', value: today },
    { label: 'Tomorrow', value: addDays(today, 1) },
    { label: 'Sunday', value: thisSunday() },
  ];

  return (
    <Screen edges={['bottom']}>
      <ErrorText>{error}</ErrorText>

      <Card>
        <Heading>What</Heading>
        <TextField label="Title" value={title} onChangeText={setTitle} maxLength={120} placeholder="Youth night" />
        <TextField label="Where (optional)" value={location} onChangeText={setLocation} maxLength={200} />
        <TextField
          label="Details (optional)"
          value={description}
          onChangeText={setDescription}
          multiline
          maxLength={2000}
          style={{ minHeight: 110, paddingTop: 12, textAlignVertical: 'top' }}
        />
      </Card>

      <Card>
        <Heading>When</Heading>
        <DateField label="Date" value={date} onChange={setDate} />
        <View style={styles.shortcuts}>
          {shortcuts.map((shortcut) => (
            <Button
              key={shortcut.label}
              title={shortcut.label}
              variant="secondary"
              style={styles.shortcut}
              onPress={() => setDate(shortcut.value)}
            />
          ))}
        </View>
        <View style={styles.times}>
          <View style={styles.time}>
            <TimeField label="Starts" value={startTime} onChange={setStartTime} />
          </View>
          <View style={styles.time}>
            <TimeField label="Ends" value={endTime} onChange={setEndTime} optional />
          </View>
        </View>
        <Body muted>
          {!dateOk
            ? 'Choose the date.'
            : !startOk
              ? 'Choose when it starts. The end time is optional.'
              : !endAfterStart
                ? 'The end has to be after the start.'
                : 'The end time is optional.'}
        </Body>
      </Card>

      <Button
        title={existing ? 'Save changes' : 'Add to the calendar'}
        onPress={onSave}
        loading={save.isPending}
        disabled={!canSave}
      />
      <Gap />
    </Screen>
  );
}

const styles = StyleSheet.create({
  shortcuts: { flexDirection: 'row', gap: Spacing.two },
  shortcut: { flex: 1, minHeight: 40 },
  times: { flexDirection: 'row', gap: Spacing.two },
  time: { flex: 1 },
});
