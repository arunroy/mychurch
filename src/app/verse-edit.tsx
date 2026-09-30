import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Body, Button, Card, ErrorText, Gap, Heading, Loading, Screen, TextField } from '@/components/ui';
import { useUserId } from '@/lib/auth';
import { lookUpVerse, TRANSLATION_NAME } from '@/lib/bible';
import { useActiveChurch } from '@/lib/church';
import { confirm } from '@/lib/confirm';
import type { DailyVerse } from '@/lib/database.types';
import { friendlyError } from '@/lib/supabase';
import {
  dateKey,
  formatVerseDate,
  isValidDateKey,
  useDeleteVerse,
  useSaveVerse,
  useVerseForDate,
} from '@/lib/verses';

// The Pastor writes or edits one day's verse. The database only lets the Pastor do this.
export default function VerseEditScreen() {
  const { date } = useLocalSearchParams<{ date?: string }>();
  const [chosenDate, setChosenDate] = useState(date && isValidDateKey(date) ? date : dateKey());
  const { church_id } = useActiveChurch();
  const existing = useVerseForDate(church_id, chosenDate);

  if (existing.isPending && isValidDateKey(chosenDate)) return <Loading />;

  // Keyed by date so switching to a day that already has a verse loads that verse's text.
  return (
    <VerseForm
      key={`${chosenDate}:${existing.data?.updated_at ?? 'new'}`}
      date={chosenDate}
      onDateChange={setChosenDate}
      existing={existing.data ?? null}
    />
  );
}

function VerseForm({
  date,
  onDateChange,
  existing,
}: {
  date: string;
  onDateChange: (date: string) => void;
  existing: DailyVerse | null;
}) {
  const { church_id } = useActiveChurch();
  const userId = useUserId();
  const save = useSaveVerse(church_id, userId!);
  const remove = useDeleteVerse(church_id);

  const [dateText, setDateText] = useState(date);
  const [reference, setReference] = useState(existing?.reference ?? '');
  const [text, setText] = useState(existing?.verse_text ?? '');
  const [translation, setTranslation] = useState(existing?.translation ?? '');
  const [reflection, setReflection] = useState(existing?.reflection ?? '');
  const [looking, setLooking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dateOk = isValidDateKey(dateText);

  function changeDate(value: string) {
    setDateText(value);
    if (isValidDateKey(value) && value !== date) onDateChange(value);
  }

  async function fillIn() {
    setLooking(true);
    setError(null);
    try {
      const found = await lookUpVerse(reference);
      setReference(found.reference);
      setText(found.text);
      setTranslation(TRANSLATION_NAME);
    } catch (e) {
      setError(friendlyError(e));
    }
    setLooking(false);
  }

  async function onSave() {
    setError(null);
    try {
      await save.mutateAsync({
        exists: !!existing,
        input: {
          verse_date: date,
          reference: reference.trim(),
          verse_text: text.trim(),
          translation: translation.trim(),
          reflection: reflection.trim(),
        },
      });
      router.back();
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  function onDelete() {
    confirm('Delete this verse?', `The verse for ${formatVerseDate(date)} will be removed.`, 'Delete', async () => {
      try {
        await remove.mutateAsync(date);
        router.back();
      } catch (e) {
        setError(friendlyError(e));
      }
    });
  }

  return (
    <Screen edges={['bottom']}>
      <ErrorText>{error}</ErrorText>

      <Card>
        <Heading>Day</Heading>
        <TextField
          label="Date"
          value={dateText}
          onChangeText={changeDate}
          placeholder="YYYY-MM-DD"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="numbers-and-punctuation"
          maxLength={10}
          hint={dateOk ? formatVerseDate(dateText) : 'Use the form 2026-09-30.'}
        />
        {existing ? <Body muted>This day already has a verse. Saving replaces it.</Body> : null}
      </Card>

      <Card>
        <Heading>Verse</Heading>
        <TextField
          label="Reference"
          value={reference}
          onChangeText={setReference}
          placeholder="John 3:16"
          maxLength={100}
          returnKeyType="search"
          onSubmitEditing={fillIn}
        />
        <Button
          title="Fill in the verse text"
          variant="secondary"
          onPress={fillIn}
          loading={looking}
          disabled={!reference.trim()}
        />
        <TextField
          label="Verse text"
          value={text}
          onChangeText={(value) => {
            setText(value);
            setTranslation('');
          }}
          multiline
          maxLength={4000}
          style={{ minHeight: 110, paddingTop: 12, textAlignVertical: 'top' }}
          hint={translation ? `${translation}, public domain. You can edit it.` : 'Fill it in from the reference, or type it yourself.'}
        />
      </Card>

      <Card>
        <Heading>Reflection</Heading>
        <TextField
          label="A few words for your church (optional)"
          value={reflection}
          onChangeText={setReflection}
          multiline
          maxLength={4000}
          style={{ minHeight: 140, paddingTop: 12, textAlignVertical: 'top' }}
        />
      </Card>

      <Button
        title={existing ? 'Save changes' : 'Save verse'}
        onPress={onSave}
        loading={save.isPending}
        disabled={!dateOk || !reference.trim() || !text.trim()}
      />
      {existing ? <Button title="Delete this verse" variant="danger" onPress={onDelete} loading={remove.isPending} /> : null}
      <Gap />
    </Screen>
  );
}
