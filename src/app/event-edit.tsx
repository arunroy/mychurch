import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const { id, date } = useLocalSearchParams<{ id?: string; date?: string }>();
  const { church_id } = useActiveChurch();
  const event = useEvent(church_id, id);

  if (id && event.isPending) return <Loading />;
  if (id && !event.data) {
    return (
      <Screen edges={['bottom']}>
        <Body muted>{t('event.gone')}</Body>
      </Screen>
    );
  }
  return <EventForm existing={event.data ?? null} initialDate={date && isValidDateKey(date) ? date : ''} />;
}

function EventForm({ existing, initialDate }: { existing: EventWithCreator | null; initialDate: string }) {
  const { t } = useTranslation();
  const { church_id } = useActiveChurch();
  const { isLeader } = usePermissions();
  const userId = useUserId();
  const save = useSaveEvent(church_id, userId!);

  const start = existing ? new Date(existing.starts_at) : null;
  const end = existing?.ends_at ? new Date(existing.ends_at) : null;
  const [title, setTitle] = useState(existing?.title ?? '');
  const [date, setDate] = useState(start ? dateKey(start) : initialDate);
  const [startTime, setStartTime] = useState(start ? timeText(start) : '');
  const [endTime, setEndTime] = useState(end ? timeText(end) : '');
  const [location, setLocation] = useState(existing?.location ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [error, setError] = useState<string | null>(null);

  if (existing && !canManageEvent(existing, userId ?? undefined, isLeader)) {
    return (
      <Screen edges={['bottom']}>
        <Body muted>{t('eventEdit.onlyOwner')}</Body>
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
    { label: t('eventEdit.today'), value: today },
    { label: t('eventEdit.tomorrow'), value: addDays(today, 1) },
    { label: t('eventEdit.sunday'), value: thisSunday() },
  ];

  return (
    <Screen edges={['bottom']}>
      <ErrorText>{error}</ErrorText>

      <Card>
        <Heading>{t('eventEdit.what')}</Heading>
        <TextField label={t('common.title')} value={title} onChangeText={setTitle} maxLength={120} placeholder={t('eventEdit.placeholder')} />
        <TextField label={t('eventEdit.where')} value={location} onChangeText={setLocation} maxLength={200} />
        <TextField
          label={t('announce.details')}
          value={description}
          onChangeText={setDescription}
          multiline
          maxLength={2000}
          style={{ minHeight: 110, paddingTop: 12, textAlignVertical: 'top' }}
        />
      </Card>

      <Card>
        <Heading>{t('eventEdit.when')}</Heading>
        <DateField label={t('study.date')} value={date} onChange={setDate} />
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
            <TimeField label={t('eventEdit.starts')} value={startTime} onChange={setStartTime} />
          </View>
          <View style={styles.time}>
            <TimeField label={t('eventEdit.ends')} value={endTime} onChange={setEndTime} optional />
          </View>
        </View>
        <Body muted>
          {!dateOk
            ? t('sermonEdit.chooseDate')
            : !startOk
              ? t('eventEdit.chooseStart')
              : !endAfterStart
                ? t('eventEdit.endAfter')
                : t('eventEdit.endOptional')}
        </Body>
      </Card>

      <Button
        title={existing ? t('notes.saveChanges') : t('eventEdit.save')}
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
