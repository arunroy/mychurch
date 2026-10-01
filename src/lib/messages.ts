import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import type { ConversationSummary, Message, Messageable } from './database.types';
import { callFunction } from './functions';
import { supabase } from './supabase';

/** Newest first, so an inverted list shows the latest message at the bottom. */
const PAGE = 200;

export function useConversations(churchId: string) {
  return useQuery({
    queryKey: ['conversations', churchId],
    queryFn: async (): Promise<ConversationSummary[]> => {
      const { data, error } = await supabase.rpc('my_conversations', { p_church: churchId });
      if (error) throw error;
      return data;
    },
  });
}

export function useUnreadCount(churchId: string) {
  const conversations = useConversations(churchId);
  return conversations.data?.filter((c) => c.unread).length ?? 0;
}

/**
 * Keeps the inbox live: whenever one of your conversations changes (a new message arrives), refetch it.
 * Call once, near the top of the signed-in screens, so every screen shares one subscription.
 */
export function useInboxRealtime(churchId: string) {
  const queryClient = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel(`inbox:${churchId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations', filter: `church_id=eq.${churchId}` },
        () => queryClient.invalidateQueries({ queryKey: ['conversations', churchId] }),
      )
      .subscribe((status) => {
        // Anything that arrived while we weren't connected.
        if (status === 'SUBSCRIBED') queryClient.invalidateQueries({ queryKey: ['conversations', churchId] });
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [churchId, queryClient]);
}

function addMessage(queryClient: QueryClient, conversationId: string, message: Message) {
  queryClient.setQueryData<Message[]>(['messages', conversationId], (old) => {
    if (!old) return [message];
    if (old.some((m) => m.id === message.id)) return old;
    return [message, ...old];
  });
}

export function useMarkRead(churchId: string) {
  const queryClient = useQueryClient();
  return async (conversationId: string) => {
    const { error } = await supabase.rpc('mark_conversation_read', { p_conversation: conversationId });
    if (!error) await queryClient.invalidateQueries({ queryKey: ['conversations', churchId] });
  };
}

/** One conversation's messages, updating live while the screen that calls this is open. */
export function useChat(conversationId: string, churchId: string, userId: string) {
  const queryClient = useQueryClient();
  const markRead = useMarkRead(churchId);

  const messages = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: async (): Promise<Message[]> => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(PAGE);
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`chat:${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const message = payload.new as Message;
          addMessage(queryClient, conversationId, message);
          if (message.sender_id !== userId) markRead(conversationId);
        },
      )
      .subscribe((status) => {
        // Catch up on anything sent before the connection was ready, or while it dropped.
        if (status === 'SUBSCRIBED') queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
      });
    return () => {
      supabase.removeChannel(channel);
    };
    // markRead only closes over the query client and church id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, userId, queryClient]);

  // Opening the chat, and each time the list of messages changes while it's open, counts as reading it.
  const newest = messages.data?.[0]?.id;
  useEffect(() => {
    if (newest) markRead(conversationId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, newest]);

  return messages;
}

export function useSendMessage(conversationId: string, userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: string): Promise<Message> => {
      const { data, error } = await supabase
        .from('messages')
        .insert({ conversation_id: conversationId, sender_id: userId, body })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (message) => {
      addMessage(queryClient, conversationId, message);
      // Tell the other person's phone. A failed push never affects the message itself.
      callFunction('notify-message', { kind: 'direct', message_id: message.id }).catch(() => {});
    },
  });
}

export function useMessageable(churchId: string) {
  return useQuery({
    queryKey: ['messageable', churchId],
    queryFn: async (): Promise<Messageable[]> => {
      const { data, error } = await supabase.rpc('messageable_members', { p_church: churchId });
      if (error) throw error;
      return data;
    },
  });
}

/** Finds or creates the chat with someone and returns its id. */
export async function startConversation(churchId: string, otherUserId: string) {
  const { data, error } = await supabase.rpc('start_conversation', { p_church: churchId, p_other: otherUserId });
  if (error) throw error;
  return data;
}
