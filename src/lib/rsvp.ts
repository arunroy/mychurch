import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { RsvpStatus, RsvpSummary } from './database.types';
import { supabase } from './supabase';

export const RSVP_CHOICES: { value: RsvpStatus; label: string }[] = [
  { value: 'going', label: 'Going' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'no', label: 'Can’t go' },
];

export function useRsvpSummary(eventId: string) {
  return useQuery({
    queryKey: ['rsvp', eventId],
    queryFn: async (): Promise<RsvpSummary> => {
      const { data, error } = await supabase.rpc('event_rsvp_summary', { p_event: eventId });
      if (error) throw error;
      return data[0];
    },
  });
}

/** Sets the caller's answer, or takes it back with null. */
export function useSetRsvp(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (status: RsvpStatus | null) => {
      const { error } = await supabase.rpc('set_rsvp', { p_event: eventId, p_status: status });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rsvp', eventId] }),
  });
}
