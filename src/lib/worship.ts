import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { addDays, dateKey, thisSunday } from './dates';
import type { SongLanguage, WorshipPlan, WorshipSong } from './database.types';
import { supabase } from './supabase';

export type WorshipPlanWithSongs = WorshipPlan & { songs: WorshipSong[] };

/** How far back plans are kept on screen: enough to find last week's songs again. */
const WEEKS_BACK = 8;

/** The plans from the last two months on, soonest first, each with its songs in order. */
export function useWorshipPlans(churchId: string) {
  return useQuery({
    queryKey: ['worship', churchId],
    queryFn: async (): Promise<WorshipPlanWithSongs[]> => {
      const since = addDays(dateKey(), -7 * WEEKS_BACK);
      const { data: plans, error } = await supabase
        .from('worship_plans')
        .select('*')
        .eq('church_id', churchId)
        .gte('service_date', since)
        .order('service_date', { ascending: true });
      if (error) throw error;
      if (plans.length === 0) return [];

      const { data: songs, error: songsError } = await supabase
        .from('worship_songs')
        .select('*')
        .in('plan_id', plans.map((p) => p.id))
        .order('position', { ascending: true });
      if (songsError) throw songsError;
      return plans.map((p) => ({ ...p, songs: songs.filter((s) => s.plan_id === p.id) }));
    },
  });
}

/** The plan for the coming Sunday (or today, when today is Sunday), if there is one. */
export function useNextWorship(churchId: string) {
  const plans = useWorshipPlans(churchId);
  const sunday = thisSunday();
  return { ...plans, data: plans.data?.find((p) => p.service_date === sunday) ?? null };
}

export type WorshipInput = {
  date: string;
  /** The Psalm, or null for none. */
  psalm: { chapter: number; verseStart: number; verseEnd: number } | null;
  note: string;
  songs: { title: string; artist: string; link: string; language: SongLanguage; tags: string[] }[];
};

export function useSaveWorshipPlan(churchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: WorshipInput) => {
      const { error } = await supabase.rpc('save_worship_plan', {
        p_church: churchId,
        p_date: input.date,
        p_chapter: input.psalm?.chapter ?? null,
        p_verse_start: input.psalm?.verseStart ?? null,
        p_verse_end: input.psalm?.verseEnd ?? null,
        p_note: input.note,
        p_songs: input.songs,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['worship', churchId] });
      // Planning adds the songs to the library.
      queryClient.invalidateQueries({ queryKey: ['songs', churchId] });
    },
  });
}

export function useDeleteWorshipPlan(churchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('worship_plans').delete().eq('id', id).eq('church_id', churchId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['worship', churchId] }),
  });
}

/** Members see the worship plan on Sunday only, until this hour in the evening (24-hour clock, the phone's time). */
const VISIBLE_UNTIL_HOUR = 18;

export function isWorshipTime(now: Date) {
  return now.getDay() === 0 && now.getHours() < VISIBLE_UNTIL_HOUR;
}

/** True during Sunday until 6 PM. Re-checks every minute, so the section appears and disappears while the app is open. */
export function useIsWorshipTime() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  return isWorshipTime(now);
}

/** Whether a link is something we can open: a web address. */
export const isWebLink = (link: string) => /^https?:\/\/\S+$/i.test(link);
