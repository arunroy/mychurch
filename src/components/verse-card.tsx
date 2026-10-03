import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text } from 'react-native';

import { Body, Button, Card, Heading, IconSquare, Label, ListSection, Row } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useLanguage } from '@/i18n/language-preference';
import { lookUpPassage } from '@/lib/bible';
import { creditFor, indianVersionFor } from '@/lib/bible-versions';
import { findBook } from '@/lib/bible-books';
import { useActiveChurch, usePermissions } from '@/lib/church';
import { formatDay } from '@/lib/dates';
import type { DailyVerse } from '@/lib/database.types';
import { useTodaysVerse } from '@/lib/verses';

/**
 * The verse in the person's Bible language, when the Pastor picked it by book, chapter and verse and that
 * language has a Bible. Otherwise null, and the card shows the text the Pastor saved.
 */
function useVerseInBibleLanguage(verse: DailyVerse) {
  const { bibleLanguage } = useLanguage();
  const version = indianVersionFor(bibleLanguage);
  const { book, chapter, verse_start, verse_end } = verse;
  const canTranslate = !!version && !!book && !!findBook(book) && !!chapter && !!verse_start;

  return useQuery({
    queryKey: ['verse-in-language', version, book, chapter, verse_start, verse_end],
    enabled: canTranslate,
    staleTime: Infinity,
    retry: false,
    queryFn: ({ signal }) =>
      lookUpPassage(
        { translation: version!, book: book!, chapter: chapter!, verseStart: verse_start!, verseEnd: verse_end ?? verse_start! },
        signal,
      ),
  });
}

/**
 * Today's verse on Home, as one row like the rest of Home: its reference, and a tap opens the verse in full. The
 * Pastor gets a row to add one when it's missing.
 */
export function VerseRow() {
  const { t } = useTranslation();
  const { church_id } = useActiveChurch();
  const { isPastor } = usePermissions();
  const verse = useTodaysVerse(church_id);

  if (verse.isPending || verse.error) return null;

  if (!verse.data) {
    if (!isPastor) return null;
    return (
      <ListSection inset={44}>
        <Row
          title={t('verse.addToday')}
          subtitle={t('verse.notChosen')}
          left={<IconSquare icon="add" color="indigo" />}
          onPress={() => router.push('/verse-edit')}
        />
      </ListSection>
    );
  }

  return <VerseRowFor verse={verse.data} />;
}

function VerseRowFor({ verse }: { verse: DailyVerse }) {
  const { t } = useTranslation();
  const translated = useVerseInBibleLanguage(verse);
  return (
    <ListSection inset={44}>
      <Row
        title={t('verse.today')}
        subtitle={translated.data?.reference ?? verse.reference}
        left={<IconSquare icon="sparkles-outline" color="indigo" />}
        onPress={() => router.push('/verse')}
      />
    </ListSection>
  );
}

/** Today's verse in full, with the reflection: the screen a tap on the Home row opens. */
export function TodaysVerse() {
  const { t } = useTranslation();
  const { church_id } = useActiveChurch();
  const { isPastor } = usePermissions();
  const verse = useTodaysVerse(church_id);

  if (verse.isPending) return null;
  if (!verse.data) {
    return (
      <Card>
        <Heading>{t('verse.today')}</Heading>
        <Body muted>{isPastor ? t('verse.notChosen') : t('verse.noneToday')}</Body>
        {isPastor ? <Button title={t('verse.addToday')} onPress={() => router.push('/verse-edit')} /> : null}
      </Card>
    );
  }
  return <VerseBody verse={verse.data} isPastor={isPastor} />;
}

function VerseBody({ verse, isPastor }: { verse: DailyVerse; isPastor: boolean }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const translated = useVerseInBibleLanguage(verse);
  const { bibleLanguage } = useLanguage();
  const version = indianVersionFor(bibleLanguage);
  const { verse_text, translation, reflection, verse_date } = verse;

  // Show the Pastor's saved copy until, and unless, the person's own language loads.
  const reference = translated.data?.reference ?? verse.reference;
  const text = translated.data?.text ?? verse_text;
  const credit = translated.data && version ? creditFor(version) : translation;

  return (
    <Card>
      <Label accent>{t('verse.ofTheDay', { date: formatDay(verse_date) })}</Label>
      <Text style={[styles.verse, { color: theme.text }]}>{`“${text}”`}</Text>
      <Text style={[styles.reference, { color: theme.textSecondary }]}>
        {reference}
        {credit ? ` · ${credit}` : ''}
      </Text>
      {reflection ? (
        <>
          <Heading>{t('verse.reflection')}</Heading>
          <Body>{reflection}</Body>
        </>
      ) : null}
      {isPastor ? (
        <Button title={t('verse.edit')} variant="secondary" onPress={() => router.push({ pathname: '/verse-edit', params: { date: verse_date } })} />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  verse: { fontSize: 21, lineHeight: 31, fontWeight: 500, letterSpacing: -0.1 },
  reference: { fontSize: 14, lineHeight: 20, fontWeight: 500 },
});
