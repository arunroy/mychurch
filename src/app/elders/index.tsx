import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';

import { ElderThread } from '@/components/elder-thread';
import { Avatar, Body, Card, ErrorText, Row, Screen } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useUserId } from '@/lib/auth';
import { useActiveChurch, usePermissions } from '@/lib/church';
import { messageTime } from '@/lib/dates';
import { useElderInbox, useMyElderThread } from '@/lib/elders';
import { friendlyError, publicUrl } from '@/lib/supabase';

// Leaders see an inbox of every member's thread. A member sees their own conversation with the elders.
export default function EldersScreen() {
  const { isLeader } = usePermissions();
  return isLeader ? <Inbox /> : <MemberThread />;
}

function Inbox() {
  const { church_id } = useActiveChurch();
  const theme = useTheme();
  const inbox = useElderInbox(church_id, true);

  return (
    <Screen edges={['bottom']}>
      {inbox.isPending ? <ActivityIndicator /> : null}
      <ErrorText>{inbox.error ? friendlyError(inbox.error) : null}</ErrorText>

      {inbox.data?.length === 0 ? (
        <Body muted>Nothing here yet. When a member writes to the elders, it shows up here for every leader.</Body>
      ) : null}

      {inbox.data && inbox.data.length > 0 ? (
        <Card>
          {inbox.data.map((thread) => (
            <Row
              key={thread.thread_id}
              title={thread.member_name || 'Church member'}
              subtitle={thread.last_message_preview}
              left={<Avatar name={thread.member_name} uri={publicUrl('avatars', thread.member_avatar_path)} />}
              right={
                <>
                  <Text style={[styles.meta, { color: theme.textSecondary }]}>{messageTime(new Date(thread.last_message_at))}</Text>
                  {thread.needs_reply ? <Text style={styles.needsReply}>Needs reply</Text> : null}
                </>
              }
              onPress={() =>
                router.push({ pathname: '/elders/[id]', params: { id: thread.thread_id, name: thread.member_name } })
              }
            />
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}

function MemberThread() {
  const { church_id } = useActiveChurch();
  const userId = useUserId();
  const mine = useMyElderThread(church_id);
  const [created, setCreated] = useState<string | null>(null);
  if (!userId) return null;

  return (
    <ElderThread
      churchId={church_id}
      userId={userId}
      threadId={mine.data?.thread_id ?? created}
      asLeader={false}
      onThreadCreated={setCreated}
    />
  );
}

const styles = StyleSheet.create({
  meta: { fontSize: 12 },
  needsReply: { color: '#D92D20', fontSize: 12, fontWeight: 700 },
});
