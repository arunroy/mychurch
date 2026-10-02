import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useId } from 'react';

import type { ChatPost } from './database.types';
import { supabase } from './supabase';

/** Newest first, so an inverted list shows the latest message at the bottom. */
const PAGE = 100;

/** Key used for General, the church-wide chat, where a group's id would go. */
export const GENERAL = 'general';

/**
 * The messages of one chat, updating live while the screen that calls this is open: General when `groupId` is
 * null, otherwise that group. Any change (a new post, or a removal) refetches, since the sender's name comes
 * from the feed. The database only sends changes for chats the person is allowed to read.
 */
export function useChurchChat(churchId: string, groupId: string | null = null) {
  const queryClient = useQueryClient();
  // Realtime hands back the same channel for the same name, and a channel that is already subscribed cannot take
  // new listeners. A name of our own for every user of this hook keeps two screens from sharing one.
  const instance = useId();

  const posts = useQuery({
    queryKey: ['church-chat', churchId, groupId ?? GENERAL],
    queryFn: async (): Promise<ChatPost[]> => {
      const { data, error } = await supabase.rpc('church_chat_feed', { p_church: churchId, p_limit: PAGE, p_group: groupId });
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    const refresh = () => queryClient.invalidateQueries({ queryKey: ['church-chat', churchId] });
    const channel = supabase
      .channel(`church-chat:${churchId}:${groupId ?? GENERAL}:${instance}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'church_chat_messages', filter: `church_id=eq.${churchId}` },
        refresh,
      )
      .subscribe((status) => {
        // Anything posted before the connection was ready, or while it dropped.
        if (status === 'SUBSCRIBED') refresh();
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [churchId, groupId, instance, queryClient]);

  return posts;
}

export function usePostToChat(churchId: string, userId: string, groupId: string | null = null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: string) => {
      const { error } = await supabase
        .from('church_chat_messages')
        .insert({ church_id: churchId, sender_id: userId, body, group_id: groupId });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['church-chat', churchId] }),
  });
}

export function useRemoveChatPost(churchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('church_chat_messages').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['church-chat', churchId] }),
  });
}

/**
 * How many messages from other people each chat has that you haven't seen, by chat: General under
 * `GENERAL` and each group under its id. This only reads the counts; `useChatUnreadLive` keeps them current.
 */
export function useChatUnreadCounts(churchId: string) {
  const unread = useQuery({
    queryKey: ['chat-unread', churchId],
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await supabase.rpc('chat_unread_counts', { p_church: churchId });
      if (error) throw error;
      return Object.fromEntries(data.map((row) => [row.group_id ?? GENERAL, row.unread]));
    },
  });
  return unread.data ?? {};
}

/** Refreshes the unread counts the moment a message arrives anywhere. Call it once, near the top of the signed-in screens. */
export function useChatUnreadLive(churchId: string) {
  const queryClient = useQueryClient();
  const instance = useId();

  useEffect(() => {
    const refresh = () => queryClient.invalidateQueries({ queryKey: ['chat-unread', churchId] });
    const channel = supabase
      .channel(`church-chat-unread:${churchId}:${instance}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'church_chat_messages', filter: `church_id=eq.${churchId}` },
        refresh,
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') refresh();
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [churchId, instance, queryClient]);
}

/** Every unread message in every chat the person is in, for the badge on the Chat tab. Also keeps the counts live. */
export function useChatUnreadCount(churchId: string) {
  useChatUnreadLive(churchId);
  const counts = useChatUnreadCounts(churchId);
  return Object.values(counts).reduce((sum, n) => sum + n, 0);
}

/** Marks one chat (General when `groupId` is null) as read up to now, and clears its badge. */
export function useMarkChatRead(churchId: string, groupId: string | null = null) {
  const queryClient = useQueryClient();
  return async () => {
    const { error } = groupId
      ? await supabase.rpc('mark_chat_group_read', { p_group: groupId })
      : await supabase.rpc('mark_church_chat_read', { p_church: churchId });
    if (!error) await queryClient.invalidateQueries({ queryKey: ['chat-unread', churchId] });
  };
}
