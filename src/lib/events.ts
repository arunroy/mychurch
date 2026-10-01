import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { dateKey, formatDay, formatTime, parseDateKey } from './dates';
import type { ChurchEvent, Profile } from './database.types';
import { supabase } from './supabase';

export type EventWithCreator = ChurchEvent & { creator: Pick<Profile, 'full_name'> | null };

const SELECT = '*, creator:profiles(full_name)';

/** Today's and later events, soonest first. */
export function useUpcomingEvents(churchId: string) {
  const today = dateKey();
  return useQuery({
    queryKey: ['events', churchId, today],
    queryFn: async (): Promise<EventWithCreator[]> => {
      const { data, error } = await supabase
        .from('events')
        .select(SELECT)
        .eq('church_id', churchId)
        .gte('starts_at', parseDateKey(today).toISOString())
        .order('starts_at')
        .limit(200);
      if (error) throw error;
      return data;
    },
  });
}

export function useEvent(churchId: string, id: string | undefined) {
  return useQuery({
    queryKey: ['event', churchId, id],
    enabled: !!id,
    queryFn: async (): Promise<EventWithCreator | null> => {
      const { data, error } = await supabase
        .from('events')
        .select(SELECT)
        .eq('church_id', churchId)
        .eq('id', id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/** The person who added an event, plus church leaders, can change or remove it. The database enforces this too. */
export function canManageEvent(event: ChurchEvent, userId: string | undefined, isLeader: boolean) {
  return isLeader || (!!userId && event.created_by === userId);
}

export function eventDayKey(event: ChurchEvent) {
  return dateKey(new Date(event.starts_at));
}

export function eventTimeText(event: ChurchEvent) {
  const start = new Date(event.starts_at);
  const end = event.ends_at ? new Date(event.ends_at) : null;
  return end ? `${formatTime(start)} – ${formatTime(end)}` : formatTime(start);
}

export function eventDayText(event: ChurchEvent) {
  return formatDay(eventDayKey(event));
}

export type EventInput = Pick<ChurchEvent, 'title' | 'description' | 'location' | 'starts_at' | 'ends_at'>;

function useInvalidateEvents(churchId: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['events', churchId] }),
      queryClient.invalidateQueries({ queryKey: ['event', churchId] }),
    ]);
}

/** Adds an event, or with an `id` changes that one. */
export function useSaveEvent(churchId: string, userId: string) {
  const invalidate = useInvalidateEvents(churchId);
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: EventInput }) => {
      if (id) {
        const { error } = await supabase
          .from('events')
          .update({ ...input, updated_at: new Date().toISOString() })
          .eq('id', id)
          .eq('church_id', churchId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('events').insert({ ...input, church_id: churchId, created_by: userId });
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
  });
}

export function useDeleteEvent(churchId: string) {
  const invalidate = useInvalidateEvents(churchId);
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('events').delete().eq('id', id).eq('church_id', churchId);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}
