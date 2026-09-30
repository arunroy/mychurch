import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Keyboard, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Button, ErrorText, Title, useAccent } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUserId } from '@/lib/auth';
import { useActiveChurch, usePermissions } from '@/lib/church';
import { useChurchChat, usePostToChat, useRemoveChatPost } from '@/lib/church-chat';
import { confirm } from '@/lib/confirm';
import { messageTime } from '@/lib/dates';
import type { ChatPost } from '@/lib/database.types';
import { friendlyError, publicUrl } from '@/lib/supabase';

function useKeyboardOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setOpen(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return open;
}

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
  const posts = useChurchChat(church_id);
  const post = usePostToChat(church_id, userId);
  const remove = useRemoveChatPost(church_id);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const keyboardOpen = useKeyboardOpen();
  // The tab bar floats over the screen: its own height plus the phone's bottom safe area.
  const tabBarHeight = Platform.select({ ios: 49, android: 80 }) ?? 0;
  const clearance = tabBarHeight + useSafeAreaInsets().bottom;

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
        onLongPress={() => onRemove(item)}
        delayLongPress={350}
        accessibilityHint={mine || isLeader ? 'Press and hold to remove' : undefined}
        style={[styles.bubbleRow, mine ? styles.mine : styles.theirs, { marginTop: startsRun ? Spacing.two : 0 }]}>
        {!mine ? (
          <View style={styles.avatarSlot}>
            {startsRun ? <Avatar name={item.sender_name} uri={publicUrl('avatars', item.sender_avatar_path)} size={32} /> : null}
          </View>
        ) : null}
        <View style={[styles.bubble, { backgroundColor: mine ? accent : theme.backgroundElement }]}>
          <Text style={[styles.sender, { color: mine ? 'rgba(255,255,255,0.85)' : accent }]}>
            {mine ? 'You' : item.sender_name || 'Church member'}
          </Text>
          <Text selectable style={[styles.body, { color: mine ? '#FFFFFF' : theme.text }]}>
            {item.body}
          </Text>
          <Text style={[styles.time, { color: mine ? 'rgba(255,255,255,0.75)' : theme.textSecondary }]}>
            {messageTime(new Date(item.created_at))}
          </Text>
        </View>
      </Pressable>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <Title>Chat</Title>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          Everyone in {church.name} can read and write here.
        </Text>
      </View>
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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

        {/* Keep the message box clear of the tab bar; the keyboard covers the bar, so no gap is needed then. */}
        <View
          style={[
            styles.composer,
            { borderTopColor: theme.backgroundSelected, paddingBottom: Spacing.two + (keyboardOpen ? 0 : clearance) },
          ]}>
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
