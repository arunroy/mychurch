import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { DailyVerse } from './database.types';
import { supabase } from './supabase';

/** Today (or any day) as the plain YYYY-MM-DD the database stores, in the phone's own time zone. */
export function dateKey(date = new Date()) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Reads a YYYY-MM-DD key as a local date, avoiding the off-by-one that `new Date('2026-09-30')` causes west of UTC. */
export function parseDateKey(key: string) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function isValidDateKey(key: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(key) && dateKey(parseDateKey(key)) === key;
}

export function formatVerseDate(key: string) {
  return parseDateKey(key).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

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

export type VerseInput = Pick<DailyVerse, 'verse_date' | 'reference' | 'verse_text' | 'translation' | 'reflection'>;

function useInvalidateVerses(churchId: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['daily-verse', churchId] }),
      queryClient.invalidateQueries({ queryKey: ['daily-verses', churchId] }),
      queryClient.invalidateQueries({ queryKey: ['daily-verse-on', churchId] }),
    ]);
}

/** Saves the verse for a day: adds it, or replaces what was there. */
export function useSaveVerse(churchId: string, userId: string) {
  const invalidate = useInvalidateVerses(churchId);
  return useMutation({
    mutationFn: async ({ input, exists }: { input: VerseInput; exists: boolean }) => {
      if (exists) {
        const { verse_date, ...changes } = input;
        const { error } = await supabase
          .from('daily_verses')
          .update({ ...changes, updated_at: new Date().toISOString() })
          .eq('church_id', churchId)
          .eq('verse_date', verse_date);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('daily_verses')
          .insert({ ...input, church_id: churchId, created_by: userId });
        if (error) throw error;
      }
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
