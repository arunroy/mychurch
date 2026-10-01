import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Sermon } from './database.types';
import { supabase } from './supabase';

/** Newest first. Leaders also get drafts, because the database lets only them read those. */
export function useSermons(churchId: string) {
  return useQuery({
    queryKey: ['sermons', churchId],
    queryFn: async (): Promise<Sermon[]> => {
      const { data, error } = await supabase
        .from('sermons')
        .select('*')
        .eq('church_id', churchId)
        .order('sermon_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });
}

export function useSermon(churchId: string, id: string | undefined) {
  return useQuery({
    queryKey: ['sermon', churchId, id],
    enabled: !!id,
    queryFn: async (): Promise<Sermon | null> => {
      const { data, error } = await supabase
        .from('sermons')
        .select('*')
        .eq('church_id', churchId)
        .eq('id', id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/** Whether a sermon matches what the person typed into the search box (title or speaker). */
export function matchesSearch(sermon: Sermon, search: string) {
  const needle = search.trim().toLowerCase();
  if (!needle) return true;
  return sermon.title.toLowerCase().includes(needle) || sermon.speaker.toLowerCase().includes(needle);
}

/** A link the app is willing to open: http or https, nothing else. */
export function isWebLink(value: string) {
  return /^https?:\/\/\S+$/i.test(value.trim()) && value.trim().length <= 500;
}

/** "sermoncentral.com" from a full address, for labelling where a link goes. */
export function linkSite(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export type SermonInput = Pick<
  Sermon,
  'title' | 'speaker' | 'sermon_date' | 'reference' | 'book' | 'chapter' | 'verse_start' | 'verse_end' | 'read_url' | 'media_url' | 'published'
>;

function useInvalidateSermons(churchId: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['sermons', churchId] }),
      queryClient.invalidateQueries({ queryKey: ['sermon', churchId] }),
    ]);
}

/** Adds a sermon, or with an `id` changes that one. Only leaders can; the database enforces it. */
export function useSaveSermon(churchId: string, userId: string) {
  const invalidate = useInvalidateSermons(churchId);
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: SermonInput }) => {
      if (id) {
        const { error } = await supabase
          .from('sermons')
          .update({ ...input, updated_at: new Date().toISOString() })
          .eq('id', id)
          .eq('church_id', churchId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('sermons').insert({ ...input, church_id: churchId, created_by: userId });
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
  });
}

export function useDeleteSermon(churchId: string) {
  const invalidate = useInvalidateSermons(churchId);
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('sermons').delete().eq('id', id).eq('church_id', churchId);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}
