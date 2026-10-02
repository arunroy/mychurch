import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GroupMembersSheet } from '@/components/group-members-sheet';
import { ReportSheet } from '@/components/report-sheet';
import { Avatar, ErrorText, useAccent, useAccentText } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUserId } from '@/lib/auth';
import { useMyChatGroups } from '@/lib/chat-groups';
import { useActiveChurch, usePermissions } from '@/lib/church';
import { useChurchChat, useMarkChatRead, usePostToChat, useRemoveChatPost } from '@/lib/church-chat';
import { confirm } from '@/lib/confirm';
import { messageTime } from '@/lib/dates';
import type { ChatGroup, ChatPost } from '@/lib/database.types';
import { friendlyError, publicUrl } from '@/lib/supabase';

// One chat: General when no group is given, otherwise that group. Opened from the Chat tab.
export default function ChatRoomScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const userId = useUserId();
  const { group: groupParam } = useLocalSearchParams<{ group?: string }>();
  const { church_id } = useActiveChurch();
  const groups = useMyChatGroups(church_id);
  const [showMembers, setShowMembers] = useState(false);
  const accentText = useAccentText();

  // A group the person has been taken out of, or that was deleted, falls back to General.
  const group: ChatGroup | null = groupParam ? (groups.data?.find((g) => g.id === groupParam) ?? null) : null;
  if (!userId || (groupParam && groups.isPending)) return null;

  return (
    <SafeAreaView edges={['bottom']} style={[styles.screen, { backgroundColor: theme.page }]}>
      <Stack.Screen
        options={{
          title: group ? group.name : t('chatTab.general'),
          headerRight: group
            ? () => (
                <Pressable accessibilityRole="button" accessibilityLabel={t('chatTab.membersTitle', { name: group.name })} onPress={() => setShowMembers(true)} hitSlop={8}>
                  <Ionicons name="people-outline" size={24} color={accentText} />
                </Pressable>
              )
            : undefined,
        }}
      />
      <Thread userId={userId} group={group} />
      {showMembers && group ? <GroupMembersSheet groupId={group.id} name={group.name} onClose={() => setShowMembers(false)} /> : null}
    </SafeAreaView>
  );
}

// One chat's messages and the box to write in. New posts appear live.
function Thread({ userId, group }: { userId: string; group: ChatGroup | null }) {
  const { t } = useTranslation();
  const { church_id } = useActiveChurch();
  const { isLeader, canManageChatGroups } = usePermissions();
  const theme = useTheme();
  const accent = useAccent();
  const accentText = useAccentText();
  const groupId = group?.id ?? null;
  const posts = useChurchChat(church_id, groupId);
  const post = usePostToChat(church_id, userId, groupId);
  const remove = useRemoveChatPost(church_id);
  const markRead = useMarkChatRead(church_id, groupId);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [reporting, setReporting] = useState<ChatPost | null>(null);

  // In General any leader can remove a message. In a group only the Pastor and elders in it can read it, so only
  // they can.
  const canModerate = groupId ? canManageChatGroups : isLeader;

  // Looking at the chat counts as reading it: when it opens, and for each new message while it's open.
  const newest = posts.data?.[0]?.id;
  useFocusEffect(
    useCallback(() => {
      markRead();
      // markRead only closes over the query client, church id and group.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [church_id, groupId, newest]),
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
    if (item.sender_id !== userId && !canModerate) return;
    confirm(t('chatTab.removeTitle'), t('chatTab.removeMessage'), t('common.remove'), async () => {
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
        accessibilityHint={mine ? t('chatTab.holdRemove') : t('chatTab.holdReport')}
        style={[styles.bubbleRow, mine ? styles.mine : styles.theirs, { marginTop: startsRun ? Spacing.two : 0 }]}>
        {!mine ? (
          <View style={styles.avatarSlot}>
            {startsRun ? <Avatar name={item.sender_name} uri={publicUrl('avatars', item.sender_avatar_path)} size={32} /> : null}
          </View>
        ) : null}
        <View style={[styles.bubble, { backgroundColor: mine ? accent : theme.backgroundElement, borderColor: theme.border, borderWidth: mine ? 0 : StyleSheet.hairlineWidth }]}>
          <Text style={[styles.sender, { color: mine ? 'rgba(255,255,255,0.92)' : accentText }]}>
            {mine ? t('prayer.you') : item.sender_name || t('newMessage.churchMember')}
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
    <>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
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
                {group ? t('chatTab.groupEmpty', { name: group.name }) : t('chatTab.empty')}
              </Text>
            }
          />
        )}

        <ErrorText>{error ?? (posts.error ? friendlyError(posts.error) : null)}</ErrorText>

        <View style={[styles.composer, { borderTopColor: theme.border, backgroundColor: theme.backgroundElement }]}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={group ? t('chatTab.groupPlaceholder', { name: group.name }) : t('chatTab.placeholder')}
            placeholderTextColor={theme.textSecondary}
            multiline
            maxLength={2000}
            style={[styles.input, { color: theme.text, backgroundColor: theme.page, borderColor: theme.border }]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.send')}
            disabled={!text.trim() || post.isPending}
            onPress={onSend}
            style={[styles.send, { backgroundColor: accent, opacity: !text.trim() || post.isPending ? 0.4 : 1 }]}>
            {post.isPending ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="arrow-up" size={20} color="#FFFFFF" />}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
      {reporting ? (
        <ReportSheet
          visible
          onClose={() => setReporting(null)}
          type="chat_message"
          targetId={reporting.id}
          onRemove={canModerate ? () => onRemove(reporting) : undefined}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: Spacing.three, gap: 2, flexGrow: 1 },
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.two },
  mine: { justifyContent: 'flex-end' },
  theirs: { justifyContent: 'flex-start' },
  avatarSlot: { width: 32 },
  bubble: { maxWidth: '78%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8, gap: 2 },
  sender: { fontSize: 13, fontWeight: 600 },
  body: { fontSize: 17, lineHeight: 22 },
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
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 16,
  },
  send: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', marginBottom: 3 },
});
