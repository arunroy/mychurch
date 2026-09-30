import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Announcement } from './database.types';
import { callFunction } from './functions';
import { supabase } from './supabase';

/** The notices still showing, newest first. This is what everyone sees on Home. */
export function useActiveAnnouncements(churchId: string) {
  return useQuery({
    queryKey: ['announcements', churchId, 'active'],
    queryFn: async (): Promise<Announcement[]> => {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('church_id', churchId)
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });
}

/** Everything, including expired notices, for the leaders who manage them. */
export function useAllAnnouncements(churchId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['announcements', churchId, 'all'],
    enabled,
    queryFn: async (): Promise<Announcement[]> => {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('church_id', churchId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });
}

export type AnnouncementInput = { title: string; body: string; expiresAt: Date | null; notify: boolean };

/** Posts a notice, and with `notify` sends a push notification to the church. Resolves to how many devices it reached. */
export function usePostAnnouncement(churchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ title, body, expiresAt, notify }: AnnouncementInput): Promise<number> => {
      const result = await callFunction<{ notified: number }>('post-announcement', {
        church_id: churchId,
        title,
        body,
        expires_at: expiresAt ? expiresAt.toISOString() : null,
        notify,
      });
      return result.notified;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['announcements', churchId] }),
  });
}

export function useRemoveAnnouncement(churchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('announcements').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['announcements', churchId] }),
  });
}
