import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { PollSummary } from './database.types';
import { supabase } from './supabase';

export function usePolls(churchId: string) {
  return useQuery({
    queryKey: ['polls', churchId],
    queryFn: async (): Promise<PollSummary[]> => {
      const { data, error } = await supabase.rpc('church_polls', { p_church: churchId });
      if (error) throw error;
      return data;
    },
  });
}

export type PollInput = {
  question: string;
  options: string[];
  multiple: boolean;
  closesAt: Date | null;
};

function useRefreshPolls(churchId: string) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['polls', churchId] });
}

export function useCreatePoll(churchId: string) {
  const refresh = useRefreshPolls(churchId);
  return useMutation({
    mutationFn: async ({ question, options, multiple, closesAt }: PollInput) => {
      const { error } = await supabase.rpc('create_poll', {
        p_church: churchId,
        p_question: question,
        p_options: options,
        p_multiple: multiple,
        p_closes_at: closesAt ? closesAt.toISOString() : null,
      });
      if (error) throw error;
    },
    onSuccess: refresh,
  });
}

export function useVote(churchId: string) {
  const refresh = useRefreshPolls(churchId);
  return useMutation({
    mutationFn: async ({ pollId, optionIds }: { pollId: string; optionIds: string[] }) => {
      const { error } = await supabase.rpc('cast_vote', { p_poll: pollId, p_options: optionIds });
      if (error) throw error;
    },
    onSuccess: refresh,
  });
}

export function useClosePoll(churchId: string) {
  const refresh = useRefreshPolls(churchId);
  return useMutation({
    mutationFn: async (pollId: string) => {
      const { error } = await supabase.rpc('close_poll', { p_poll: pollId });
      if (error) throw error;
    },
    onSuccess: refresh,
  });
}

export function useDeletePoll(churchId: string) {
  const refresh = useRefreshPolls(churchId);
  return useMutation({
    mutationFn: async (pollId: string) => {
      const { error } = await supabase.rpc('delete_poll', { p_poll: pollId });
      if (error) throw error;
    },
    onSuccess: refresh,
  });
}
