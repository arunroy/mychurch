import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Announcement } from './database.types';
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

export type AnnouncementInput = { title: string; body: string; expiresAt: Date | null };

export function usePostAnnouncement(churchId: string, userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ title, body, expiresAt }: AnnouncementInput) => {
      const { error } = await supabase.from('announcements').insert({
        church_id: churchId,
        author_id: userId,
        title,
        body,
        expires_at: expiresAt ? expiresAt.toISOString() : null,
      });
      if (error) throw error;
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
