import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar, Body, Button, Card, ErrorText, Gap, Heading, Loading, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useUserId } from '@/lib/auth';
import { useActiveChurch, usePermissions } from '@/lib/church';
import { confirm } from '@/lib/confirm';
import type { PrayerRequest } from '@/lib/database.types';
import { shortDate } from '@/lib/durations';
import { useRemoveRequest, usePrayerRequests, useSetAnswered, useTogglePrayed, visibilityLabel } from '@/lib/prayers';
import { friendlyError, publicUrl } from '@/lib/supabase';

// Prayer requests the church has shared with you. Tap "I prayed" to let people know they are not alone.
export default function PrayerScreen() {
  const { church_id } = useActiveChurch();
  const userId = useUserId();
  const requests = usePrayerRequests(church_id);

  const open = requests.data?.filter((r) => !r.answered) ?? [];
  const answered = requests.data?.filter((r) => r.answered) ?? [];

  return (
    <Screen edges={['bottom']}>
      <Button title="Share a prayer request" onPress={() => router.push('/prayer-new')} />
      <ErrorText>{requests.error ? friendlyError(requests.error) : null}</ErrorText>
      {requests.isPending ? <Loading /> : null}
      {requests.data?.length === 0 ? <Body muted>No prayer requests yet. Share one, and the church will pray with you.</Body> : null}

      {userId ? open.map((request) => <RequestCard key={request.id} request={request} userId={userId} />) : null}

      {answered.length > 0 ? <Heading>Answered</Heading> : null}
      {userId ? answered.map((request) => <RequestCard key={request.id} request={request} userId={userId} />) : null}
      <Gap />
    </Screen>
  );
}

function RequestCard({ request, userId }: { request: PrayerRequest; userId: string }) {
  const { church_id } = useActiveChurch();
  const { isLeader } = usePermissions();
  const pray = useTogglePrayed(church_id);
  const answer = useSetAnswered(church_id);
  const remove = useRemoveRequest(church_id);
  const [error, setError] = useState<string | null>(null);

  const mine = request.author_id === userId;
  const name = mine ? 'You' : request.author_name || 'Church member';

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  const prayedText =
    request.prayer_count === 0
      ? 'No one has prayed yet'
      : request.prayer_count === 1
        ? '1 person prayed'
        : `${request.prayer_count} people prayed`;

  return (
    <Card>
      <View style={styles.header}>
        <Avatar name={request.author_name} uri={publicUrl('avatars', request.author_avatar_path)} size={36} />
        <View style={styles.headerText}>
          <Heading>{name}</Heading>
          <Body muted>{`${shortDate(request.created_at)} · ${visibilityLabel(request.visibility)}`}</Body>
        </View>
      </View>

      <Body>{request.body}</Body>
      {request.answered ? <Body muted>{`Answered${request.answered_at ? ` · ${shortDate(request.answered_at)}` : ''}`}</Body> : null}

      <Body muted>{prayedText}</Body>
      <ErrorText>{error}</ErrorText>

      <Button
        title={request.i_prayed ? 'You prayed ✓ (tap to undo)' : 'I prayed'}
        variant={request.i_prayed ? 'secondary' : 'primary'}
        loading={pray.isPending}
        onPress={() => run(() => pray.mutateAsync(request.id))}
      />

      {mine ? (
        <Button
          title={request.answered ? 'Reopen this request' : 'Mark as answered'}
          variant="secondary"
          loading={answer.isPending}
          onPress={() => run(() => answer.mutateAsync({ requestId: request.id, answered: !request.answered }))}
        />
      ) : null}
      {mine || isLeader ? (
        <Button
          title="Remove"
          variant="danger"
          loading={remove.isPending}
          onPress={() =>
            confirm('Remove this request?', 'It will disappear for everyone, along with its prayers.', 'Remove', () =>
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
