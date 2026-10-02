import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { DateField } from '@/components/date-time-fields';
import { Body, Button, Card, ErrorText, Gap, Heading, Loading, Screen, TextField } from '@/components/ui';
import { PassagePreview, toPassage, usePassagePreview, VersePicker, type PassageDraft } from '@/components/verse-picker';
import { findBook, findTranslation } from '@/lib/bible-books';
import { useActiveChurch } from '@/lib/church';
import { confirm } from '@/lib/confirm';
import { dateKey, formatDay, isValidDateKey } from '@/lib/dates';
import type { DailyVerse } from '@/lib/database.types';
import { friendlyError } from '@/lib/supabase';
import { useDeleteVerse, useSaveVerse, useVerseForDate } from '@/lib/verses';

// The Pastor picks one day's verse: translation, book, chapter and verses. The verse text is never
// typed; the save-daily-verse function fetches it. Only the Pastor can save (the function checks).
export default function VerseEditScreen() {
  const { date } = useLocalSearchParams<{ date?: string }>();
  const [chosenDate, setChosenDate] = useState(date && isValidDateKey(date) ? date : dateKey());
  const { church_id } = useActiveChurch();
  const existing = useVerseForDate(church_id, chosenDate);

  if (existing.isPending && isValidDateKey(chosenDate)) return <Loading />;

  // Keyed by date so switching to a day that already has a verse loads that verse's pick.
  return (
    <VerseForm
      key={`${chosenDate}:${existing.data?.updated_at ?? 'new'}`}
      date={chosenDate}
      onDateChange={setChosenDate}
      existing={existing.data ?? null}
    />
  );
}

/** Starts from the saved pick. Verses saved before the picker existed have no book, so the Pastor picks again. */
function draftFrom(existing: DailyVerse | null): PassageDraft {
  const translation = findTranslation(existing?.translation_code ?? '')?.code ?? 'web';
  if (existing?.book && findBook(existing.book) && existing.chapter && existing.verse_start) {
    return {
      translation,
      book: existing.book,
      chapter: existing.chapter,
      verseStart: existing.verse_start,
      verseEnd: existing.verse_end ?? existing.verse_start,
    };
  }
  return { translation, book: null, chapter: 1, verseStart: 1, verseEnd: 1 };
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
  const { t } = useTranslation();
  const { church_id } = useActiveChurch();
  const save = useSaveVerse(church_id);
  const remove = useDeleteVerse(church_id);

  const [dateText, setDateText] = useState(date);
  const [passage, setPassage] = useState<PassageDraft>(() => draftFrom(existing));
  const [reflection, setReflection] = useState(existing?.reflection ?? '');
  const [error, setError] = useState<string | null>(null);

  const chosen = toPassage(passage);
  const preview = usePassagePreview(chosen);
  const dateOk = isValidDateKey(dateText);

  function changeDate(value: string) {
    setDateText(value);
    if (isValidDateKey(value) && value !== date) onDateChange(value);
  }

  async function onSave() {
    if (!chosen) return;
    setError(null);
    try {
      await save.mutateAsync({
        verse_date: date,
        translation_code: chosen.translation,
        book: chosen.book,
        chapter: chosen.chapter,
        verse_start: chosen.verseStart,
        verse_end: chosen.verseEnd,
        reflection: reflection.trim(),
      });
      router.back();
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  function onDelete() {
    confirm(t('dailyVerse.deleteTitle'), t('dailyVerse.deleteMessage', { day: formatDay(date) }), t('common.delete'), async () => {
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
        <Heading>{t('dailyVerse.day')}</Heading>
        <DateField label={t('study.date')} value={dateText} onChange={changeDate} hint={dateOk ? formatDay(dateText) : t('sermonEdit.chooseDate')} />
        {existing ? <Body muted>{t('dailyVerse.existing')}</Body> : null}
      </Card>

      <Card>
        <Heading>{t('dailyVerse.verseHeading')}</Heading>
        <VersePicker value={passage} onChange={setPassage} />
        <PassagePreview passage={chosen} />
      </Card>

      <Card>
        <Heading>{t('verse.reflection')}</Heading>
        <TextField
          label={t('dailyVerse.reflectionLabel')}
          value={reflection}
          onChangeText={setReflection}
          multiline
          maxLength={4000}
          style={{ minHeight: 140, paddingTop: 12, textAlignVertical: 'top' }}
        />
      </Card>

      <Button
        title={existing ? t('notes.saveChanges') : t('dailyVerse.save')}
        onPress={onSave}
        loading={save.isPending}
        disabled={!dateOk || !chosen || !preview.isSuccess}
      />
      {existing ? <Button title={t('dailyVerse.deleteButton')} variant="danger" onPress={onDelete} loading={remove.isPending} /> : null}
      <Gap />
    </Screen>
  );
}
