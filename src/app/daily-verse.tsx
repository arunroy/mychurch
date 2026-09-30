import { router } from 'expo-router';

import { Body, Button, Card, ErrorText, Heading, Loading, Row, Screen } from '@/components/ui';
import { useActiveChurch } from '@/lib/church';
import { friendlyError } from '@/lib/supabase';
import { dateKey, formatVerseDate, parseDateKey, useUpcomingVerses } from '@/lib/verses';

function nextFreeDate(taken: string[]) {
  const day = parseDateKey(dateKey());
  while (taken.includes(dateKey(day))) day.setDate(day.getDate() + 1);
  return dateKey(day);
}

// The Pastor's plan: today's verse and the ones scheduled ahead.
export default function DailyVerseScreen() {
  const { church_id } = useActiveChurch();
  const verses = useUpcomingVerses(church_id, true);

  if (verses.isPending) return <Loading />;

  const list = verses.data ?? [];
  const today = dateKey();

  return (
    <Screen edges={['bottom']}>
      <ErrorText>{verses.error ? friendlyError(verses.error) : null}</ErrorText>

      <Button
        title="Add a verse"
        onPress={() =>
          router.push({ pathname: '/verse-edit', params: { date: nextFreeDate(list.map((v) => v.verse_date)) } })
        }
      />

      <Card>
        <Heading>Today and coming up</Heading>
        {list.length === 0 ? (
          <Body muted>Nothing is planned yet. Members see the verse for each day once that day arrives.</Body>
        ) : (
          list.map((verse) => (
            <Row
              key={verse.verse_date}
              title={verse.reference}
              subtitle={`${verse.verse_date === today ? 'Today' : formatVerseDate(verse.verse_date)}${
                verse.reflection ? ' · with reflection' : ''
              }`}
              onPress={() => router.push({ pathname: '/verse-edit', params: { date: verse.verse_date } })}
            />
          ))
        )}
      </Card>

      {!list.some((v) => v.verse_date === today) ? (
        <Body muted>There&apos;s no verse for today yet, so members see nothing on their Home screen.</Body>
      ) : null}
    </Screen>
  );
}
