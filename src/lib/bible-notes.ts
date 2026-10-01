import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useUserId } from './auth';
import type { BibleNote } from './database.types';
import { supabase } from './supabase';

/** The person's notes on one chapter, by verse number. Row level security keeps them to the signed-in person. */
export function useChapterNotes(book: string, chapter: number) {
  const userId = useUserId();
  return useQuery({
    queryKey: ['bible-notes', userId, book, chapter],
    enabled: !!userId,
    queryFn: async (): Promise<Map<number, BibleNote>> => {
      const { data, error } = await supabase
        .from('bible_notes')
        .select('*')
        .eq('user_id', userId!)
        .eq('book', book)
        .eq('chapter', chapter);
      if (error) throw error;
      return new Map(data.map((note) => [note.verse, note]));
    },
  });
}

/** Every note the person has written, newest edit first. */
export function useAllNotes() {
  const userId = useUserId();
  return useQuery({
    queryKey: ['bible-notes', userId, 'all'],
    enabled: !!userId,
    queryFn: async (): Promise<BibleNote[]> => {
      const { data, error } = await supabase
        .from('bible_notes')
        .select('*')
        .eq('user_id', userId!)
        .order('updated_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
  });
}

function useRefreshNotes() {
  const queryClient = useQueryClient();
  const userId = useUserId();
  return () => queryClient.invalidateQueries({ queryKey: ['bible-notes', userId] });
}

/** Adds a note on a verse, or replaces the text of the one already there. */
export function useSaveNote() {
  const userId = useUserId();
  const refresh = useRefreshNotes();
  return useMutation({
    mutationFn: async ({ book, chapter, verse, body, existing }: { book: string; chapter: number; verse: number; body: string; existing: BibleNote | null }) => {
      const { error } = existing
        ? await supabase.from('bible_notes').update({ body, updated_at: new Date().toISOString() }).eq('id', existing.id)
        : await supabase.from('bible_notes').insert({ user_id: userId!, book, chapter, verse, body });
      if (error) throw error;
    },
    onSuccess: refresh,
  });
}

export function useDeleteNote() {
  const refresh = useRefreshNotes();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('bible_notes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: refresh,
  });
}
