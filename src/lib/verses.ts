import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { TranslationCode } from './bible-books';
import { dateKey, isValidDateKey } from './dates';
import type { DailyVerse } from './database.types';
import { callFunction } from './functions';
import { supabase } from './supabase';

export function useTodaysVerse(churchId: string) {
  const today = dateKey();
  return useQuery({
    queryKey: ['daily-verse', churchId, today],
    queryFn: async (): Promise<DailyVerse | null> => {
      const { data, error } = await supabase
        .from('daily_verses')
        .select('*')
        .eq('church_id', churchId)
        .eq('verse_date', today)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/** Today and everything scheduled after it, for the Pastor's planning list. */
export function useUpcomingVerses(churchId: string, enabled: boolean) {
  const today = dateKey();
  return useQuery({
    queryKey: ['daily-verses', churchId, today],
    enabled,
    queryFn: async (): Promise<DailyVerse[]> => {
      const { data, error } = await supabase
        .from('daily_verses')
        .select('*')
        .eq('church_id', churchId)
        .gte('verse_date', today)
        .order('verse_date')
        .limit(60);
      if (error) throw error;
      return data;
    },
  });
}

export function useVerseForDate(churchId: string, date: string) {
  return useQuery({
    queryKey: ['daily-verse-on', churchId, date],
    enabled: isValidDateKey(date),
    queryFn: async (): Promise<DailyVerse | null> => {
      const { data, error } = await supabase
        .from('daily_verses')
        .select('*')
        .eq('church_id', churchId)
        .eq('verse_date', date)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/** What the Pastor picks. There is no verse text: the server fetches it from the Bible. */
export type VerseInput = {
  verse_date: string;
  translation_code: TranslationCode;
  book: string;
  chapter: number;
  verse_start: number;
  verse_end: number;
  reflection: string;
};

function useInvalidateVerses(churchId: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['daily-verse', churchId] }),
      queryClient.invalidateQueries({ queryKey: ['daily-verses', churchId] }),
      queryClient.invalidateQueries({ queryKey: ['daily-verse-on', churchId] }),
    ]);
}

/** Saves the verse for a day: adds it, or replaces what was there. The function stores the text. */
export function useSaveVerse(churchId: string) {
  const invalidate = useInvalidateVerses(churchId);
  return useMutation({
    mutationFn: async (input: VerseInput) => {
      await callFunction('save-daily-verse', { ...input, church_id: churchId });
    },
    onSuccess: invalidate,
  });
}

export function useDeleteVerse(churchId: string) {
  const invalidate = useInvalidateVerses(churchId);
  return useMutation({
    mutationFn: async (date: string) => {
      const { error } = await supabase.from('daily_verses').delete().eq('church_id', churchId).eq('verse_date', date);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}
