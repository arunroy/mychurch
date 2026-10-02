import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { SongLanguage, SongLibraryEntry } from './database.types';
import { supabase } from './supabase';

/** The languages a song can be tagged with: the app's own five, and everything else. */
export const SONG_LANGUAGES: SongLanguage[] = ['en', 'hi', 'ta', 'ml', 'kn', 'other'];

export const MAX_TAGS = 5;
export const MAX_TAG_LENGTH = 24;

/** Tags as typed ("Praise, communion  , PRAISE") to what is stored: lower-case, no repeats, five at most. */
export function normalizeTags(text: string): string[] {
  const seen = new Set<string>();
  for (const part of text.split(/[,\n]/)) {
    const tag = part.trim().toLowerCase().slice(0, MAX_TAG_LENGTH);
    if (tag) seen.add(tag);
  }
  return [...seen].slice(0, MAX_TAGS);
}

/** Opens YouTube's own search for a song, so a planner can find a recording and paste its link. No API key is needed. */
export function youtubeSearchUrl(title: string, artist: string) {
  const query = [title.trim(), artist.trim()].filter(Boolean).join(' ');
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

/** The church's song library with how often and when each song was sung. Only the people who can plan worship may ask. */
export function useSongLibrary(churchId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['songs', churchId],
    enabled,
    retry: false,
    queryFn: async (): Promise<SongLibraryEntry[]> => {
      const { data, error } = await supabase.rpc('song_library', { p_church: churchId });
      if (error) throw error;
      return data.map((s) => ({ ...s, times_sung: Number(s.times_sung) }));
    },
  });
}

export type SongInput = { title: string; artist: string; link: string; language: SongLanguage; tags: string[] };

/** Adds a song to the library, or with an id changes that one. */
export function useSaveSong(churchId: string, userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string | null; input: SongInput }) => {
      const { error } = id
        ? await supabase.from('church_songs').update(input).eq('id', id).eq('church_id', churchId)
        : await supabase.from('church_songs').insert({ church_id: churchId, created_by: userId, ...input });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['songs', churchId] }),
  });
}

export function useDeleteSong(churchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('church_songs').delete().eq('id', id).eq('church_id', churchId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['songs', churchId] });
      queryClient.invalidateQueries({ queryKey: ['worship', churchId] });
    },
  });
}

/** How long ago a Sunday was, in whole weeks (0 means this week). */
export function weeksAgo(dateKeyValue: string, today = new Date()) {
  const [y, m, d] = dateKeyValue.split('-').map(Number);
  const then = new Date(y, m - 1, d);
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.max(0, Math.round((start.getTime() - then.getTime()) / (7 * 24 * 3600 * 1000)));
}
