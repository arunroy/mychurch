import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Body, Button, Card, ErrorText, Heading, Loading, Row, Screen } from '@/components/ui';
import { useActiveChurch } from '@/lib/church';
import { dateKey, formatDay, parseDateKey } from '@/lib/dates';
import { friendlyError } from '@/lib/supabase';
import { useUpcomingVerses } from '@/lib/verses';

function nextFreeDate(taken: string[]) {
  const day = parseDateKey(dateKey());
  while (taken.includes(dateKey(day))) day.setDate(day.getDate() + 1);
  return dateKey(day);
}

// The Pastor's plan: today's verse and the ones scheduled ahead.
export default function DailyVerseScreen() {
  const { t } = useTranslation();
  const { church_id } = useActiveChurch();
  const verses = useUpcomingVerses(church_id, true);

  if (verses.isPending) return <Loading />;

  const list = verses.data ?? [];
  const today = dateKey();

  return (
    <Screen edges={['bottom']}>
      <ErrorText>{verses.error ? friendlyError(verses.error) : null}</ErrorText>

      <Button
        title={t('dailyVerse.add')}
        onPress={() =>
          router.push({ pathname: '/verse-edit', params: { date: nextFreeDate(list.map((v) => v.verse_date)) } })
        }
      />

      <Card>
        <Heading>{t('dailyVerse.upcoming')}</Heading>
        {list.length === 0 ? (
          <Body muted>{t('dailyVerse.nothing')}</Body>
        ) : (
          list.map((verse) => (
            <Row
              key={verse.verse_date}
              title={verse.reference}
              subtitle={
                verse.reflection
                  ? t('dailyVerse.withReflection', { day: verse.verse_date === today ? t('dailyVerse.today') : formatDay(verse.verse_date) })
                  : verse.verse_date === today
                    ? t('dailyVerse.today')
                    : formatDay(verse.verse_date)
              }
              onPress={() => router.push({ pathname: '/verse-edit', params: { date: verse.verse_date } })}
            />
          ))
        )}
      </Card>

      {!list.some((v) => v.verse_date === today) ? (
        <Body muted>{t('dailyVerse.noneToday')}</Body>
      ) : null}
    </Screen>
  );
}
