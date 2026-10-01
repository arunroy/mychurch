import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { ElderInboxItem, ElderMessage, MyElderThread } from './database.types';
import { callFunction } from './functions';
import { supabase } from './supabase';

// The elders inbox is read through functions the database offers, which are not live-updating the way
// tables are, so these screens refresh on a timer while they are open.
const OPEN_SCREEN_REFRESH_MS = 5000;
const BADGE_REFRESH_MS = 30000;

/** The caller's own thread with the elders, or null if they have never written. */
export function useMyElderThread(churchId: string) {
  return useQuery({
    queryKey: ['elders', churchId, 'mine'],
    refetchInterval: BADGE_REFRESH_MS,
    queryFn: async (): Promise<MyElderThread | null> => {
      const { data, error } = await supabase.rpc('my_elder_thread', { p_church: churchId });
      if (error) throw error;
      return data[0] ?? null;
    },
  });
}

/** Leaders only: every member's thread, ones waiting for a reply first. */
export function useElderInbox(churchId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['elders', churchId, 'inbox'],
    enabled,
    refetchInterval: BADGE_REFRESH_MS,
    queryFn: async (): Promise<ElderInboxItem[]> => {
      const { data, error } = await supabase.rpc('elder_inbox', { p_church: churchId });
      if (error) throw error;
      return data;
    },
  });
}

/** How many things need this person's attention in the elders inbox, for the Messages tab badge. */
export function useEldersBadge(churchId: string, isLeader: boolean) {
  const mine = useMyElderThread(churchId);
  const inbox = useElderInbox(churchId, isLeader);
  if (isLeader) return inbox.data?.filter((t) => t.needs_reply).length ?? 0;
  return mine.data?.unread ? 1 : 0;
}

/** One thread's messages, newest first. Refreshes while the screen is open. */
export function useElderMessages(threadId: string | null) {
  return useQuery({
    queryKey: ['elders', 'messages', threadId],
    enabled: !!threadId,
    refetchInterval: OPEN_SCREEN_REFRESH_MS,
    queryFn: async (): Promise<ElderMessage[]> => {
      const { data, error } = await supabase.rpc('elder_thread_messages', { p_thread: threadId! });
      if (error) throw error;
      return data;
    },
  });
}

function useRefreshElders(churchId: string) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['elders'] }).then(() => churchId);
}

/** A member writes to the elders. Resolves to the thread id, so the screen can switch to it. */
export function useSendToElders(churchId: string) {
  const refresh = useRefreshElders(churchId);
  return useMutation({
    mutationFn: async (body: string): Promise<string> => {
      const { data, error } = await supabase.rpc('send_to_elders', { p_church: churchId, p_body: body });
      if (error) throw error;
      const { thread_id, message_id } = data[0];
      callFunction('notify-message', { kind: 'elders', message_id }).catch(() => {});
      return thread_id;
    },
    onSuccess: refresh,
  });
}

/** A leader replies in a member's thread. */
export function useReplyAsElder(churchId: string) {
  const refresh = useRefreshElders(churchId);
  return useMutation({
    mutationFn: async ({ threadId, body }: { threadId: string; body: string }) => {
      const { data, error } = await supabase.rpc('reply_as_elder', { p_thread: threadId, p_body: body });
      if (error) throw error;
      callFunction('notify-message', { kind: 'elders', message_id: data }).catch(() => {});
    },
    onSuccess: refresh,
  });
}

export function useMarkElderRead(churchId: string) {
  const refresh = useRefreshElders(churchId);
  return async (threadId: string) => {
    const { error } = await supabase.rpc('mark_elder_thread_read', { p_thread: threadId });
    if (!error) await refresh();
  };
}
