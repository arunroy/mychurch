import { router } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';

import { Avatar, Body, Button, Card, ErrorText, Row, Screen, Title } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useUserId } from '@/lib/auth';
import { useAnonymousBadge } from '@/lib/anonymous';
import { useActiveChurch, usePermissions } from '@/lib/church';
import { messageTime } from '@/lib/dates';
import { useEldersBadge } from '@/lib/elders';
import { useConversations } from '@/lib/messages';
import { friendlyError, publicUrl } from '@/lib/supabase';

// Your private conversations with other people in the church. Updates live as messages arrive.
export default function MessagesScreen() {
  const { church_id } = useActiveChurch();
  const userId = useUserId();
  const theme = useTheme();
  const conversations = useConversations(church_id);
  const { isLeader, isPastor } = usePermissions();
  const anonymousBadge = useAnonymousBadge(church_id, isPastor);
  const eldersBadge = useEldersBadge(church_id, isLeader);

  return (
    <Screen edges={['top']}>
      <Title>Messages</Title>

      <Card>
        <Row
          title={isLeader ? 'Elders inbox' : 'Message the elders'}
          subtitle={
            isLeader
              ? eldersBadge > 0
                ? `${eldersBadge} waiting for a reply`
                : 'What members have written to the elders'
              : eldersBadge > 0
                ? 'You have a new reply'
                : 'Every church leader can read and reply'
          }
          right={eldersBadge > 0 ? <Text accessibilityLabel="New" style={styles.dot}>●</Text> : undefined}
          onPress={() => router.push('/elders')}
        />
        {isPastor ? (
          <Row
            title="Anonymous inbox"
            subtitle={anonymousBadge > 0 ? `${anonymousBadge} unread` : 'Messages nobody can trace to a person'}
            right={anonymousBadge > 0 ? <Text accessibilityLabel="Unread" style={styles.dot}>●</Text> : undefined}
            onPress={() => router.push('/anonymous-inbox')}
          />
        ) : (
          <Row title="Message the Pastor anonymously" subtitle="Your name is not saved" onPress={() => router.push('/anonymous')} />
        )}
      </Card>

      <Button title="New message" onPress={() => router.push('/new-message')} />

      {conversations.isPending ? <ActivityIndicator /> : null}
      <ErrorText>{conversations.error ? friendlyError(conversations.error) : null}</ErrorText>

      {conversations.data && conversations.data.length === 0 ? (
        <Card>
          <Body muted>
            No conversations yet. Message your Pastor, an elder or anyone else in the church. Only the two of you can
            read what you write.
          </Body>
        </Card>
      ) : null}

      {conversations.data && conversations.data.length > 0 ? (
        <Card>
          {conversations.data.map((chat) => (
            <Row
              key={chat.id}
              title={chat.other_name || 'Church member'}
              subtitle={`${chat.last_sender_id === userId ? 'You: ' : ''}${chat.last_message_preview}`}
              left={<Avatar name={chat.other_name} uri={publicUrl('avatars', chat.other_avatar_path)} />}
              right={
                <>
                  <Text style={[styles.time, { color: theme.textSecondary }]}>{messageTime(new Date(chat.last_message_at))}</Text>
                  {chat.unread ? <Text accessibilityLabel="Unread" style={styles.dot}>●</Text> : null}
                </>
              }
              onPress={() =>
                router.push({ pathname: '/chat/[id]', params: { id: chat.id, name: chat.other_name } })
              }
            />
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  time: { fontSize: 13 },
  dot: { color: '#3B5BDB', fontSize: 14 },
});
