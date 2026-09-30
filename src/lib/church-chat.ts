import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import type { ChatPost } from './database.types';
import { supabase } from './supabase';

/** Newest first, so an inverted list shows the latest message at the bottom. */
const PAGE = 100;

/**
 * The church's public chat room, updating live while the screen that calls this is open.
 * Any change (a new post, or a removal) refetches, since the sender's name comes from the feed.
 */
export function useChurchChat(churchId: string) {
  const queryClient = useQueryClient();

  const posts = useQuery({
    queryKey: ['church-chat', churchId],
    queryFn: async (): Promise<ChatPost[]> => {
      const { data, error } = await supabase.rpc('church_chat_feed', { p_church: churchId, p_limit: PAGE });
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    const refresh = () => queryClient.invalidateQueries({ queryKey: ['church-chat', churchId] });
    const channel = supabase
      .channel(`church-chat:${churchId}`)
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
  }, [churchId, queryClient]);

  return posts;
}

export function usePostToChat(churchId: string, userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: string) => {
      const { error } = await supabase.from('church_chat_messages').insert({ church_id: churchId, sender_id: userId, body });
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
