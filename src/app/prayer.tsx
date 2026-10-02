import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ReportButton } from '@/components/report-sheet';
import { Avatar, Body, Button, Card, ErrorText, Gap, Heading, Loading, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useUserId } from '@/lib/auth';
import { useActiveChurch, usePermissions } from '@/lib/church';
import { confirm } from '@/lib/confirm';
import type { PrayerRequest } from '@/lib/database.types';
import { shortDate } from '@/lib/durations';
import { useRemoveRequest, usePrayerRequests, useSetAnswered, useTogglePrayed } from '@/lib/prayers';
import { friendlyError, publicUrl } from '@/lib/supabase';

// Prayer requests the church has shared with you. Tap "I prayed" to let people know they are not alone.
export default function PrayerScreen() {
  const { t } = useTranslation();
  const { church_id } = useActiveChurch();
  const userId = useUserId();
  const requests = usePrayerRequests(church_id);

  const open = requests.data?.filter((r) => !r.answered) ?? [];
  const answered = requests.data?.filter((r) => r.answered) ?? [];

  return (
    <Screen edges={['bottom']}>
      <Button title={t('prayer.share')} onPress={() => router.push('/prayer-new')} />
      <ErrorText>{requests.error ? friendlyError(requests.error) : null}</ErrorText>
      {requests.isPending ? <Loading /> : null}
      {requests.data?.length === 0 ? <Body muted>{t('prayer.empty')}</Body> : null}

      {userId ? open.map((request) => <RequestCard key={request.id} request={request} userId={userId} />) : null}

      {answered.length > 0 ? <Heading>{t('prayer.answered')}</Heading> : null}
      {userId ? answered.map((request) => <RequestCard key={request.id} request={request} userId={userId} />) : null}
      <Gap />
    </Screen>
  );
}

function RequestCard({ request, userId }: { request: PrayerRequest; userId: string }) {
  const { t } = useTranslation();
  const { church_id } = useActiveChurch();
  const { isLeader } = usePermissions();
  const pray = useTogglePrayed(church_id);
  const answer = useSetAnswered(church_id);
  const remove = useRemoveRequest(church_id);
  const [error, setError] = useState<string | null>(null);

  const mine = request.author_id === userId;
  const name = mine ? t('prayer.you') : request.author_name || t('newMessage.churchMember');

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  const prayedText = request.prayer_count === 0 ? t('prayer.none') : t('prayer.prayed', { count: request.prayer_count });

  return (
    <Card>
      <View style={styles.header}>
        <Avatar name={request.author_name} uri={publicUrl('avatars', request.author_avatar_path)} size={36} />
        <View style={styles.headerText}>
          <Heading>{name}</Heading>
          <Body muted>{`${shortDate(request.created_at)} · ${t(`prayer.vis${request.visibility[0].toUpperCase()}${request.visibility.slice(1)}`)}`}</Body>
        </View>
      </View>

      <Body>{request.body}</Body>
      {request.answered ? <Body muted>{request.answered_at ? t('prayer.answeredOn', { date: shortDate(request.answered_at) }) : t('prayer.answered')}</Body> : null}

      <Body muted>{prayedText}</Body>
      <ErrorText>{error}</ErrorText>

      <Button
        title={request.i_prayed ? t('prayer.youPrayed') : t('prayer.iPrayed')}
        variant={request.i_prayed ? 'secondary' : 'primary'}
        loading={pray.isPending}
        onPress={() => run(() => pray.mutateAsync(request.id))}
      />

      {!mine ? <ReportButton type="prayer_request" targetId={request.id} /> : null}

      {mine ? (
        <Button
          title={request.answered ? t('prayer.reopen') : t('prayer.markAnswered')}
          variant="secondary"
          loading={answer.isPending}
          onPress={() => run(() => answer.mutateAsync({ requestId: request.id, answered: !request.answered }))}
        />
      ) : null}
      {mine || isLeader ? (
        <Button
          title={t('common.remove')}
          variant="danger"
          loading={remove.isPending}
          onPress={() =>
            confirm(t('prayer.removeTitle'), t('prayer.removeMessage'), t('common.remove'), () =>
              run(() => remove.mutateAsync(request.id)),
            )
          }
        />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  headerText: { flex: 1 },
});
