import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { SpecialDayEntry, SpecialDayKind } from './database.types';
import { supabase } from './supabase';

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** How many days a month has, counting 29 February (birthdays have no year). */
export function daysInMonth(month: number) {
  return DAYS_IN_MONTH[month - 1];
}

export function formatMonthDay(month: number, day: number) {
  return `${day} ${MONTHS[month - 1]}`;
}

export type UpcomingDay = SpecialDayEntry & {
  /** 0 is today. */
  daysAway: number;
  /** Years being celebrated, for an anniversary that has a year. */
  years: number | null;
};

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** The next time a month and day comes round, counting today. 29 February is kept on 28 February in years without one. */
function nextOccurrence(month: number, day: number, today: Date) {
  for (let year = today.getFullYear(); year <= today.getFullYear() + 1; year++) {
    const date = new Date(year, month - 1, day);
    if (date.getMonth() !== month - 1) date.setTime(new Date(year, month - 1, day - 1).getTime());
    if (date >= today) return date;
  }
  return today;
}

/** Everything coming up within `withinDays` (today included), soonest first. */
export function upcoming(entries: SpecialDayEntry[], withinDays: number, now = new Date()): UpcomingDay[] {
  const today = startOfDay(now);
  return entries
    .map((entry) => {
      const date = nextOccurrence(entry.month, entry.day, today);
      const daysAway = Math.round((date.getTime() - today.getTime()) / 86_400_000);
      const years = entry.kind === 'anniversary' && entry.year ? date.getFullYear() - entry.year : null;
      return { ...entry, daysAway, years };
    })
    .filter((entry) => entry.daysAway <= withinDays)
    .sort((a, b) => a.daysAway - b.daysAway || a.name.localeCompare(b.name));
}

/** Every birthday and anniversary in the church: leader-added dates and members' own birthdays. */
export function useSpecialDays(churchId: string) {
  return useQuery({
    queryKey: ['special-days', churchId],
    queryFn: async (): Promise<SpecialDayEntry[]> => {
      const { data, error } = await supabase.rpc('church_special_days', { p_church: churchId });
      if (error) throw error;
      return data;
    },
  });
}

export type SpecialDayInput = { kind: SpecialDayKind; name: string; month: number; day: number; year: number | null };

export function useAddSpecialDay(churchId: string, userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ kind, name, month, day, year }: SpecialDayInput) => {
      const { error } = await supabase
        .from('special_days')
        .insert({ church_id: churchId, kind, name, month, day, year, created_by: userId });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['special-days', churchId] }),
  });
}

export function useRemoveSpecialDay(churchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('special_days').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['special-days', churchId] }),
  });
}
