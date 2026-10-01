import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ReportSheet } from '@/components/report-sheet';
import { Avatar, Button, ErrorText, Title, useAccent, useAccentText } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUserId } from '@/lib/auth';
import { useActiveChurch, usePermissions } from '@/lib/church';
import { useChurchChat, useMarkChatRead, usePostToChat, useRemoveChatPost } from '@/lib/church-chat';
import { confirm } from '@/lib/confirm';
import { messageTime } from '@/lib/dates';
import type { ChatPost } from '@/lib/database.types';
import { friendlyError, publicUrl } from '@/lib/supabase';
import { useTabBarHeight } from '@/lib/tab-bar';

export default function ChatTab() {
  const userId = useUserId();
  if (!userId) return null;
  return <ChurchChat userId={userId} />;
}

// The church's public chat: everyone approved in the church can read it and post. New posts appear live.
function ChurchChat({ userId }: { userId: string }) {
  const { church_id, church } = useActiveChurch();
  const { isLeader } = usePermissions();
  const theme = useTheme();
  const accent = useAccent();
  const accentText = useAccentText();
  const posts = useChurchChat(church_id);
  const post = usePostToChat(church_id, userId);
  const remove = useRemoveChatPost(church_id);
  const markRead = useMarkChatRead(church_id);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [reporting, setReporting] = useState<ChatPost | null>(null);
  const tabBarHeight = useTabBarHeight();

  // Looking at the chat counts as reading it: when the tab opens, and for each new message while it's open.
  const newest = posts.data?.[0]?.id;
  useFocusEffect(
    useCallback(() => {
      markRead();
      // markRead only closes over the query client and church id.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [church_id, newest]),
  );

  async function onSend() {
    const body = text.trim();
    if (!body || post.isPending) return;
    setError(null);
    try {
      await post.mutateAsync(body);
      setText('');
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  function onRemove(item: ChatPost) {
    if (item.sender_id !== userId && !isLeader) return;
    confirm('Remove this message?', 'It will disappear for everyone in the chat.', 'Remove', async () => {
      try {
        await remove.mutateAsync(item.id);
      } catch (e) {
        setError(friendlyError(e));
      }
    });
  }

  function renderPost({ item, index }: { item: ChatPost; index: number }) {
    const mine = item.sender_id === userId;
    // The list is newest first, so the next item is the one written just before this one.
    const previous = posts.data?.[index + 1];
    const startsRun = previous?.sender_id !== item.sender_id;
    return (
      <Pressable
        onLongPress={() => (mine ? onRemove(item) : setReporting(item))}
        delayLongPress={350}
        accessibilityHint={mine ? 'Press and hold to remove' : 'Press and hold to report'}
        style={[styles.bubbleRow, mine ? styles.mine : styles.theirs, { marginTop: startsRun ? Spacing.two : 0 }]}>
        {!mine ? (
          <View style={styles.avatarSlot}>
            {startsRun ? <Avatar name={item.sender_name} uri={publicUrl('avatars', item.sender_avatar_path)} size={32} /> : null}
          </View>
        ) : null}
        <View style={[styles.bubble, { backgroundColor: mine ? accent : theme.backgroundElement }]}>
          <Text style={[styles.sender, { color: mine ? 'rgba(255,255,255,0.92)' : accentText }]}>
            {mine ? 'You' : item.sender_name || 'Church member'}
          </Text>
          <Text selectable style={[styles.body, { color: mine ? '#FFFFFF' : theme.text }]}>
            {item.body}
          </Text>
          <Text style={[styles.time, { color: mine ? 'rgba(255,255,255,0.85)' : theme.textSecondary }]}>
            {messageTime(new Date(item.created_at))}
          </Text>
        </View>
      </Pressable>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: theme.page }]}>
      <View style={styles.header}>
        <Title>Chat</Title>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          Everyone in {church.name} can read and write here.
        </Text>
      </View>
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? tabBarHeight : 0}>
        {posts.isPending ? (
          <View style={styles.center}>
            <ActivityIndicator />
          </View>
        ) : (
          <FlatList
            inverted
            data={posts.data ?? []}
            keyExtractor={(item) => item.id}
            renderItem={renderPost}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <Text style={[styles.empty, { color: theme.textSecondary }, styles.flip]}>
                No messages yet. Say hello to your church family.
              </Text>
            }
          />
        )}

        <ErrorText>{error ?? (posts.error ? friendlyError(posts.error) : null)}</ErrorText>

        <View style={[styles.composer, { borderTopColor: theme.backgroundSelected }]}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Message the church"
            placeholderTextColor={theme.textSecondary}
            multiline
            maxLength={2000}
            style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
          />
          <Button title="Send" onPress={onSend} loading={post.isPending} disabled={!text.trim()} style={styles.send} />
        </View>
      </KeyboardAvoidingView>
      {reporting ? (
        <ReportSheet
          visible
          onClose={() => setReporting(null)}
          type="chat_message"
          targetId={reporting.id}
          onRemove={isLeader ? () => onRemove(reporting) : undefined}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingHorizontal: Spacing.three, paddingTop: Spacing.three, gap: Spacing.one },
  subtitle: { fontSize: 14, lineHeight: 19 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: Spacing.three, gap: 2, flexGrow: 1 },
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.two },
  mine: { justifyContent: 'flex-end' },
  theirs: { justifyContent: 'flex-start' },
  avatarSlot: { width: 32 },
  bubble: { maxWidth: '78%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8, gap: 2 },
  sender: { fontSize: 13, fontWeight: 600 },
  body: { fontSize: 16, lineHeight: 22 },
  time: { fontSize: 11, alignSelf: 'flex-end' },
  empty: { textAlign: 'center', padding: Spacing.four, fontSize: 15, lineHeight: 21 },
  // The list is inverted, so an empty-state message has to be flipped back.
  flip: { transform: [{ scaleY: -1 }] },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    padding: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 16,
  },
  send: { minHeight: 44, borderRadius: 22 },
});
