import { router } from 'expo-router';

import { Body, Button, Card, Heading } from '@/components/ui';
import { useActiveChurch, usePermissions } from '@/lib/church';
import { formatVerseDate, useTodaysVerse } from '@/lib/verses';

/** Today's verse and reflection on the Home screen. Leaders get a nudge to add one when it's missing. */
export function VerseCard() {
  const { church_id } = useActiveChurch();
  const { isPastor } = usePermissions();
  const verse = useTodaysVerse(church_id);

  if (verse.isPending || verse.error) return null;

  if (!verse.data) {
    if (!isPastor) return null;
    return (
      <Card>
        <Heading>Today&apos;s verse</Heading>
        <Body muted>You haven&apos;t chosen a verse for today yet.</Body>
        <Button title="Add today's verse" onPress={() => router.push('/verse-edit')} />
      </Card>
    );
  }

  const { reference, verse_text, translation, reflection, verse_date } = verse.data;
  return (
    <Card>
      <Body muted>{`Verse of the day · ${formatVerseDate(verse_date)}`}</Body>
      <Heading>{reference}</Heading>
      <Body>{`“${verse_text}”`}</Body>
      {translation ? <Body muted>{translation}</Body> : null}
      {reflection ? (
        <>
          <Heading>Reflection</Heading>
          <Body>{reflection}</Body>
        </>
      ) : null}
      {isPastor ? (
        <Button title="Edit" variant="secondary" onPress={() => router.push({ pathname: '/verse-edit', params: { date: verse_date } })} />
      ) : null}
    </Card>
  );
}
