import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Body, Button, Card, ErrorText, Heading, Loading, Screen, Title } from '@/components/ui';
import { useUserId } from '@/lib/auth';
import { useActiveChurch, usePermissions } from '@/lib/church';
import { confirm } from '@/lib/confirm';
import { canManageEvent, eventDayText, eventTimeText, useDeleteEvent, useEvent } from '@/lib/events';
import { friendlyError } from '@/lib/supabase';

export default function EventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { church_id } = useActiveChurch();
  const { isLeader } = usePermissions();
  const userId = useUserId();
  const event = useEvent(church_id, id);
  const remove = useDeleteEvent(church_id);
  const [error, setError] = useState<string | null>(null);

  if (event.isPending) return <Loading />;

  if (!event.data) {
    return (
      <Screen edges={['bottom']}>
        <Body muted>This event is no longer on the calendar.</Body>
        <Button title="Back to the calendar" variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }

  const item = event.data;
  const canManage = canManageEvent(item, userId ?? undefined, isLeader);

  function onDelete() {
    confirm('Delete this event?', `“${item.title}” will be removed from the church calendar for everyone.`, 'Delete', async () => {
      try {
        await remove.mutateAsync(item.id);
        router.back();
      } catch (e) {
        setError(friendlyError(e));
      }
    });
  }

  return (
    <Screen edges={['bottom']}>
      <Title>{item.title}</Title>
      <ErrorText>{error}</ErrorText>

      <Card>
        <Heading>{eventDayText(item)}</Heading>
        <Body>{eventTimeText(item)}</Body>
        {item.location ? <Body muted>{item.location}</Body> : null}
      </Card>

      {item.description ? (
        <Card>
          <Body>{item.description}</Body>
        </Card>
      ) : null}

      <Body muted>{item.creator?.full_name ? `Added by ${item.creator.full_name}` : 'Added by a church member'}</Body>

      {canManage ? (
        <>
          <Button title="Edit" variant="secondary" onPress={() => router.push({ pathname: '/event-edit', params: { id: item.id } })} />
          <Button title="Delete this event" variant="danger" onPress={onDelete} loading={remove.isPending} />
        </>
      ) : null}
    </Screen>
  );
}
