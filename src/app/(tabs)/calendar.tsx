import { router } from 'expo-router';
import { ActivityIndicator } from 'react-native';

import { Body, Button, Card, ErrorText, Heading, Row, Screen, Title } from '@/components/ui';
import { useActiveChurch } from '@/lib/church';
import { dateKey, formatDay } from '@/lib/dates';
import { eventDayKey, eventTimeText, useUpcomingEvents } from '@/lib/events';
import { friendlyError } from '@/lib/supabase';

// The church's shared calendar: anyone can add to it, everyone sees it.
export default function CalendarScreen() {
  const { church_id } = useActiveChurch();
  const events = useUpcomingEvents(church_id);

  const days = new Map<string, NonNullable<typeof events.data>>();
  for (const event of events.data ?? []) {
    const key = eventDayKey(event);
    days.set(key, [...(days.get(key) ?? []), event]);
  }
  const today = dateKey();

  return (
    <Screen edges={['top']}>
      <Title>Calendar</Title>

      <Button title="Add an event" onPress={() => router.push('/event-edit')} />

      {events.isPending ? <ActivityIndicator /> : null}
      <ErrorText>{events.error ? friendlyError(events.error) : null}</ErrorText>

      {events.data && events.data.length === 0 ? (
        <Card>
          <Heading>Nothing coming up</Heading>
          <Body muted>Anyone in the church can add an event, and everyone sees it here.</Body>
        </Card>
      ) : null}

      {[...days].map(([key, list]) => (
        <Card key={key}>
          <Heading>{key === today ? `Today · ${formatDay(key)}` : formatDay(key)}</Heading>
          {list.map((event) => (
            <Row
              key={event.id}
              title={event.title}
              subtitle={[eventTimeText(event), event.location].filter(Boolean).join(' · ')}
              onPress={() => router.push({ pathname: '/event/[id]', params: { id: event.id } })}
            />
          ))}
        </Card>
      ))}
    </Screen>
  );
}
