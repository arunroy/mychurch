import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, ErrorText, useAccent } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUserId } from '@/lib/auth';
import { useActiveChurch } from '@/lib/church';
import { messageTime } from '@/lib/dates';
import type { Message } from '@/lib/database.types';
import { useChat, useConversations, useSendMessage } from '@/lib/messages';
import { friendlyError } from '@/lib/supabase';

export default function ChatScreen() {
  const userId = useUserId();
  if (!userId) return null;
  return <Chat userId={userId} />;
}

// A private conversation. New messages appear here as they arrive, without refreshing.
function Chat({ userId }: { userId: string }) {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const { church_id } = useActiveChurch();
  const theme = useTheme();
  const accent = useAccent();
  const conversations = useConversations(church_id);
  const messages = useChat(id, church_id, userId);
  const send = useSendMessage(id, userId);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const partner = conversations.data?.find((c) => c.id === id)?.other_name || name || 'Chat';

  async function onSend() {
    const body = text.trim();
    if (!body || send.isPending) return;
    setError(null);
    try {
      await send.mutateAsync(body);
      setText('');
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  function renderMessage({ item }: { item: Message }) {
    const mine = item.sender_id === userId;
    return (
      <View style={[styles.bubbleRow, mine ? styles.mine : styles.theirs]}>
        <View style={[styles.bubble, { backgroundColor: mine ? accent : theme.backgroundElement }]}>
          <Text selectable style={[styles.body, { color: mine ? '#FFFFFF' : theme.text }]}>
            {item.body}
          </Text>
          <Text style={[styles.time, { color: mine ? 'rgba(255,255,255,0.75)' : theme.textSecondary }]}>
            {messageTime(new Date(item.created_at))}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView edges={['bottom']} style={[styles.screen, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ title: partner }} />
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
        {messages.isPending ? (
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
                Say hello to {partner}. Only the two of you can read this conversation.
              </Text>
            }
          />
        )}

        <ErrorText>{error ?? (messages.error ? friendlyError(messages.error) : null)}</ErrorText>

        <View style={[styles.composer, { borderTopColor: theme.backgroundSelected }]}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Message"
            placeholderTextColor={theme.textSecondary}
            multiline
            maxLength={2000}
            style={[
              styles.input,
              { color: theme.text, backgroundColor: theme.backgroundElement },
            ]}
          />
          <Button title="Send" onPress={onSend} loading={send.isPending} disabled={!text.trim()} style={styles.send} />
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
