import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';

import { Avatar, Body, Button, Card, ErrorText, Row, Screen, Title, useAccentText } from '@/components/ui';
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
  const { t } = useTranslation();
  const { church_id } = useActiveChurch();
  const userId = useUserId();
  const theme = useTheme();
  const accentText = useAccentText();
  const conversations = useConversations(church_id);
  const { isLeader, isPastor } = usePermissions();
  const anonymousBadge = useAnonymousBadge(church_id, isPastor);
  const eldersBadge = useEldersBadge(church_id, isLeader);

  return (
    <Screen edges={['top']}>
      <Title>{t('messagesTab.title')}</Title>

      <Card>
        <Row
          title={isLeader ? t('messagesTab.eldersInbox') : t('messagesTab.messageElders')}
          subtitle={
            isLeader
              ? eldersBadge > 0
                ? t('messagesTab.waitingReply', { count: eldersBadge })
                : t('messagesTab.whatWritten')
              : eldersBadge > 0
                ? t('messagesTab.newReply')
                : t('messagesTab.everyLeader')
          }
          right={eldersBadge > 0 ? <Text accessibilityLabel={t('messagesTab.new')} style={[styles.dot, { color: accentText }]}>●</Text> : undefined}
          onPress={() => router.push('/elders')}
        />
        {isPastor ? (
          <Row
            title={t('messagesTab.anonInbox')}
            subtitle={anonymousBadge > 0 ? t('messagesTab.unread', { count: anonymousBadge }) : t('messagesTab.untraceable')}
            right={anonymousBadge > 0 ? <Text accessibilityLabel={t('messagesTab.unreadLabel')} style={[styles.dot, { color: accentText }]}>●</Text> : undefined}
            onPress={() => router.push('/anonymous-inbox')}
          />
        ) : (
          <Row title={t('messagesTab.anonWrite')} subtitle={t('messagesTab.nameNotSaved')} onPress={() => router.push('/anonymous')} />
        )}
      </Card>

      <Button title={t('messagesTab.newMessage')} onPress={() => router.push('/new-message')} />

      {conversations.isPending ? <ActivityIndicator /> : null}
      <ErrorText>{conversations.error ? friendlyError(conversations.error) : null}</ErrorText>

      {conversations.data && conversations.data.length === 0 ? (
        <Card>
          <Body muted>{t('messagesTab.noConversations')}</Body>
        </Card>
      ) : null}

      {conversations.data && conversations.data.length > 0 ? (
        <Card>
          {conversations.data.map((chat) => (
            <Row
              key={chat.id}
              title={chat.other_name || t('newMessage.churchMember')}
              subtitle={chat.last_sender_id === userId ? t('messagesTab.youColon', { text: chat.last_message_preview }) : chat.last_message_preview}
              left={<Avatar name={chat.other_name} uri={publicUrl('avatars', chat.other_avatar_path)} />}
              right={
                <>
                  <Text style={[styles.time, { color: theme.textSecondary }]}>{messageTime(new Date(chat.last_message_at))}</Text>
                  {chat.unread ? <Text accessibilityLabel={t('messagesTab.unreadLabel')} style={[styles.dot, { color: accentText }]}>●</Text> : null}
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
  dot: { fontSize: 14 },
});
