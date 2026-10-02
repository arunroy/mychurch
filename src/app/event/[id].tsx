import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { EventExtras } from '@/components/event-extras';
import { ReportButton } from '@/components/report-sheet';
import { Body, Button, Card, ErrorText, Heading, Loading, Screen, Title } from '@/components/ui';
import { useUserId } from '@/lib/auth';
import { useActiveChurch, usePermissions } from '@/lib/church';
import { confirm } from '@/lib/confirm';
import { canManageEvent, eventDayText, eventTimeText, useDeleteEvent, useEvent } from '@/lib/events';
import { friendlyError } from '@/lib/supabase';

export default function EventScreen() {
  const { t } = useTranslation();
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
        <Body muted>{t('event.gone')}</Body>
        <Button title={t('event.back')} variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }

  const item = event.data;
  const canManage = canManageEvent(item, userId ?? undefined, isLeader);

  function onDelete() {
    confirm(t('event.deleteTitle'), t('event.deleteMessage', { title: item.title }), t('common.delete'), async () => {
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

      <EventExtras event={item} />

      <Body muted>{item.creator?.full_name ? t('event.addedBy', { name: item.creator.full_name }) : t('event.addedByMember')}</Body>

      {item.created_by !== userId ? <ReportButton type="event" targetId={item.id} /> : null}

      {canManage ? (
        <>
          <Button title={t('verse.edit')} variant="secondary" onPress={() => router.push({ pathname: '/event-edit', params: { id: item.id } })} />
          <Button title={t('event.deleteButton')} variant="danger" onPress={onDelete} loading={remove.isPending} />
        </>
      ) : null}
    </Screen>
  );
}
