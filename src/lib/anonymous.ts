import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { AnonymousInboxItem, AnonymousReplyCheck } from './database.types';
import { dateKey } from './dates';
import { supabase } from './supabase';

// Anonymous messages to the Pastor. The app never learns or stores who wrote one. A sender who wants an
// answer gets a code, and keeps it on their own phone to check back for the reply.

const CODES_KEY = 'anonymous-reply-codes';

export type SavedCode = { code: string; sentOn: string; preview: string };

async function readCodes(): Promise<SavedCode[]> {
  try {
    return JSON.parse((await AsyncStorage.getItem(CODES_KEY)) ?? '[]') as SavedCode[];
  } catch {
    return [];
  }
}

/** The reply codes kept on this phone, newest first. */
export function useSavedCodes() {
  return useQuery({ queryKey: ['anonymous-codes'], queryFn: readCodes });
}

/** Sends an anonymous message. Resolves to the reply code if one was asked for (it is also saved on this phone). */
export function useSendAnonymous(churchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ body, wantReply }: { body: string; wantReply: boolean }): Promise<string | null> => {
      const { data, error } = await supabase.rpc('send_anonymous_message', {
        p_church: churchId,
        p_body: body,
        p_want_reply: wantReply,
      });
      if (error) throw error;
      if (data) {
        const codes = await readCodes();
        const saved: SavedCode = { code: data, sentOn: dateKey(), preview: body.slice(0, 80) };
        await AsyncStorage.setItem(CODES_KEY, JSON.stringify([saved, ...codes].slice(0, 30))).catch(() => {});
      }
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['anonymous-codes'] }),
  });
}

/** Looks up a reply by its code. */
export async function checkReply(code: string): Promise<AnonymousReplyCheck> {
  const { data, error } = await supabase.rpc('check_anonymous_reply', { p_code: code });
  if (error) throw error;
  return data[0];
}

/** The Pastor's inbox: unread first. Returns nothing for anyone else. */
export function useAnonymousInbox(churchId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['anonymous-inbox', churchId],
    enabled,
    refetchInterval: 30000,
    queryFn: async (): Promise<AnonymousInboxItem[]> => {
      const { data, error } = await supabase.rpc('anonymous_inbox', { p_church: churchId });
      if (error) throw error;
      return data;
    },
  });
}

/** How many anonymous messages the Pastor has not read, for the Messages tab badge. */
export function useAnonymousBadge(churchId: string, isPastor: boolean) {
  const inbox = useAnonymousInbox(churchId, isPastor);
  return inbox.data?.filter((m) => !m.is_read).length ?? 0;
}

function useRefreshInbox(churchId: string) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['anonymous-inbox', churchId] });
}

export function useMarkAnonymousRead(churchId: string) {
  const refresh = useRefreshInbox(churchId);
  return useMutation({
    mutationFn: async (messageId: string) => {
      const { error } = await supabase.rpc('mark_anonymous_read', { p_message: messageId });
      if (error) throw error;
    },
    onSuccess: refresh,
  });
}

export function useReplyToAnonymous(churchId: string) {
  const refresh = useRefreshInbox(churchId);
  return useMutation({
    mutationFn: async ({ messageId, reply }: { messageId: string; reply: string }) => {
      const { error } = await supabase.rpc('reply_to_anonymous', { p_message: messageId, p_reply: reply });
      if (error) throw error;
    },
    onSuccess: refresh,
  });
}

export function useDeleteAnonymous(churchId: string) {
  const refresh = useRefreshInbox(churchId);
  return useMutation({
    mutationFn: async (messageId: string) => {
      const { error } = await supabase.rpc('delete_anonymous_message', { p_message: messageId });
      if (error) throw error;
    },
    onSuccess: refresh,
  });
}
