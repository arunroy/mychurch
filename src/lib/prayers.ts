import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { PrayerRequest, PrayerVisibility } from './database.types';
import { supabase } from './supabase';

export const VISIBILITY_CHOICES: { value: PrayerVisibility; label: string; hint: string }[] = [
  { value: 'church', label: 'The church', hint: 'Everyone in the church can see this and pray.' },
  { value: 'leaders', label: 'Leaders', hint: 'Only the Pastor, elders and church admins can see this.' },
  { value: 'pastor', label: 'Pastor only', hint: 'Only the Pastor can see this.' },
];

export function visibilityLabel(visibility: PrayerVisibility) {
  return {
    church: 'Shared with the church',
    leaders: 'Leaders only',
    pastor: 'Pastor only',
  }[visibility];
}

export function usePrayerRequests(churchId: string) {
  return useQuery({
    queryKey: ['prayers', churchId],
    queryFn: async (): Promise<PrayerRequest[]> => {
      const { data, error } = await supabase.rpc('prayer_feed', { p_church: churchId });
      if (error) throw error;
      return data;
    },
  });
}

function useRefreshPrayers(churchId: string) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['prayers', churchId] });
}

export function useShareRequest(churchId: string) {
  const refresh = useRefreshPrayers(churchId);
  return useMutation({
    mutationFn: async ({ body, visibility }: { body: string; visibility: PrayerVisibility }) => {
      const { error } = await supabase.rpc('create_prayer_request', {
        p_church: churchId,
        p_body: body,
        p_visibility: visibility,
      });
      if (error) throw error;
    },
    onSuccess: refresh,
  });
}

export function useTogglePrayed(churchId: string) {
  const refresh = useRefreshPrayers(churchId);
  return useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await supabase.rpc('toggle_prayed', { p_request: requestId });
      if (error) throw error;
    },
    onSuccess: refresh,
  });
}

export function useSetAnswered(churchId: string) {
  const refresh = useRefreshPrayers(churchId);
  return useMutation({
    mutationFn: async ({ requestId, answered }: { requestId: string; answered: boolean }) => {
      const { error } = await supabase.rpc('set_prayer_answered', { p_request: requestId, p_answered: answered });
      if (error) throw error;
    },
    onSuccess: refresh,
  });
}

export function useRemoveRequest(churchId: string) {
  const refresh = useRefreshPrayers(churchId);
  return useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await supabase.rpc('delete_prayer_request', { p_request: requestId });
      if (error) throw error;
    },
    onSuccess: refresh,
  });
}
