import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, ErrorText, useAccent } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { messageTime } from '@/lib/dates';
import type { ElderMessage } from '@/lib/database.types';
import { useElderMessages, useMarkElderRead, useReplyAsElder, useSendToElders } from '@/lib/elders';
import { friendlyError } from '@/lib/supabase';

/**
 * A conversation with the elders. A member sees their own thread and writes to "the elders"; a leader
 * opens a member's thread and replies under their own name. Refreshes by itself while open.
 */
export function ElderThread({
  churchId,
  userId,
  threadId,
  asLeader,
  onThreadCreated,
}: {
  churchId: string;
  userId: string;
  /** Null until the member sends their first message. */
  threadId: string | null;
  asLeader: boolean;
  onThreadCreated?: (id: string) => void;
}) {
  const theme = useTheme();
  const accent = useAccent();
  const messages = useElderMessages(threadId);
  const send = useSendToElders(churchId);
  const reply = useReplyAsElder(churchId);
  const markRead = useMarkElderRead(churchId);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  // A member opening their thread, or getting a new reply while it is open, counts as reading it.
  const newest = messages.data?.[0]?.id;
  useEffect(() => {
    if (!asLeader && threadId && newest) markRead(threadId);
    // markRead only closes over the query client.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asLeader, threadId, newest]);

  const busy = send.isPending || reply.isPending;

  async function onSend() {
    const body = text.trim();
    if (!body || busy) return;
    setError(null);
    try {
      if (asLeader && threadId) {
        await reply.mutateAsync({ threadId, body });
      } else {
        const created = await send.mutateAsync(body);
        onThreadCreated?.(created);
      }
      setText('');
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  function renderMessage({ item }: { item: ElderMessage }) {
    const mine = item.sender_id === userId;
    return (
      <View style={[styles.bubbleRow, mine ? styles.mine : styles.theirs]}>
        <View style={[styles.bubble, { backgroundColor: mine ? accent : theme.backgroundElement }]}>
          {!mine ? <Text style={[styles.sender, { color: theme.textSecondary }]}>{item.sender_name || 'Church member'}</Text> : null}
          <Text selectable style={[styles.body, { color: mine ? '#FFFFFF' : theme.text }]}>
            {item.body}
          </Text>
          <Text style={[styles.time, { color: mine ? 'rgba(255,255,255,0.85)' : theme.textSecondary }]}>
            {messageTime(new Date(item.created_at))}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView edges={['bottom']} style={[styles.screen, { backgroundColor: theme.page }]}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
        {threadId && messages.isPending ? (
          <View style={styles.center}>
            <ActivityIndicator />
          </View>
        ) : (
          <FlatList
            inverted
            data={messages.data ?? []}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <Text style={[styles.empty, { color: theme.textSecondary }, styles.flip]}>
                {asLeader
                  ? 'No messages in this thread yet.'
                  : 'Write to the elders. The Pastor, elders and church admins can all read and reply, and nobody else can.'}
              </Text>
            }
          />
        )}

        <ErrorText>{error ?? (messages.error ? friendlyError(messages.error) : null)}</ErrorText>

        <View style={[styles.composer, { borderTopColor: theme.backgroundSelected }]}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={asLeader ? 'Reply' : 'Message the elders'}
            placeholderTextColor={theme.textSecondary}
            multiline
            maxLength={2000}
            style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
          />
          <Button title="Send" onPress={onSend} loading={busy} disabled={!text.trim()} style={styles.send} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: Spacing.three, gap: Spacing.two, flexGrow: 1 },
  bubbleRow: { flexDirection: 'row' },
  mine: { justifyContent: 'flex-end' },
  theirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '82%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8, gap: 2 },
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
