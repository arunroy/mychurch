import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Fundraiser, FundraiserEntry, FundraiserSummary } from './database.types';
import { supabase } from './supabase';

/** Every fundraiser of the church with its totals, open ones first. Members get no names, only these totals. */
export function useFundraisers(churchId: string) {
  return useQuery({
    queryKey: ['fundraisers', churchId, 'list'],
    queryFn: async (): Promise<FundraiserSummary[]> => {
      const { data, error } = await supabase.rpc('fundraiser_summaries', { p_church: churchId });
      if (error) throw error;
      // Postgres hands numeric columns back as numbers through PostgREST, but be safe about strings.
      return data.map((f) => ({
        ...f,
        target_amount: f.target_amount === null ? null : Number(f.target_amount),
        received_total: Number(f.received_total),
        pledged_total: Number(f.pledged_total),
        my_pledge: f.my_pledge === null ? null : Number(f.my_pledge),
      }));
    },
  });
}

export function useOpenFundraiserCount(churchId: string) {
  const list = useFundraisers(churchId);
  return list.data?.filter((f) => f.status === 'active').length ?? 0;
}

/** Pledges count as raised, as soon as they are made: the total is what was received plus what members pledged. */
export const raisedOf = (f: Pick<FundraiserSummary, 'received_total' | 'pledged_total'>) => f.received_total + f.pledged_total;

/** How far along a fundraiser is, as a share from 0 to 1 of the target, and what is left. Null without a target. */
export function progressOf(f: Pick<FundraiserSummary, 'target_amount' | 'received_total' | 'pledged_total'>) {
  if (!f.target_amount) return null;
  const raised = raisedOf(f);
  return {
    share: Math.min(1, raised / f.target_amount),
    left: Math.max(0, f.target_amount - raised),
    reached: raised >= f.target_amount,
  };
}

function useRefresh(churchId: string) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['fundraisers', churchId] });
}

/** A member says what they can give. Zero takes their pledge back. */
export function useSetPledge(churchId: string) {
  const refresh = useRefresh(churchId);
  return useMutation({
    mutationFn: async ({ fundraiserId, amount }: { fundraiserId: string; amount: number }) => {
      const { error } = await supabase.rpc('set_my_pledge', { p_fundraiser: fundraiserId, p_amount: amount });
      if (error) throw error;
    },
    onSuccess: refresh,
  });
}

export type FundraiserInput = {
  title: string;
  description: string;
  target_amount: number | null;
  currency: string;
};

export function useSaveFundraiser(churchId: string, userId: string) {
  const refresh = useRefresh(churchId);
  return useMutation({
    mutationFn: async ({ id, input }: { id: string | null; input: FundraiserInput }) => {
      const { error } = id
        ? await supabase.from('fundraisers').update(input).eq('id', id).eq('church_id', churchId)
        : await supabase.from('fundraisers').insert({ church_id: churchId, created_by: userId, ...input });
      if (error) throw error;
    },
    onSuccess: refresh,
  });
}

export function useSetFundraiserStatus(churchId: string) {
  const refresh = useRefresh(churchId);
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Fundraiser['status'] }) => {
      const { error } = await supabase.from('fundraisers').update({ status }).eq('id', id).eq('church_id', churchId);
      if (error) throw error;
    },
    onSuccess: refresh,
  });
}

export function useDeleteFundraiser(churchId: string) {
  const refresh = useRefresh(churchId);
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('fundraisers').delete().eq('id', id).eq('church_id', churchId);
      if (error) throw error;
    },
    onSuccess: refresh,
  });
}

/** Everything given and pledged to one fundraiser, with names. Only the Pastor and elders can read it. */
export function useFundraiserEntries(fundraiserId: string, churchId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['fundraisers', churchId, 'entries', fundraiserId],
    enabled,
    retry: false,
    queryFn: async (): Promise<FundraiserEntry[]> => {
      const { data, error } = await supabase
        .from('fundraiser_entries')
        .select('*')
        .eq('fundraiser_id', fundraiserId)
        .order('occurred_on', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data.map((e) => ({ ...e, amount: Number(e.amount) }));
    },
  });
}

export type ReceivedInput = {
  amount: number;
  party_name: string;
  party_user_id: string | null;
  occurred_on: string;
  note: string;
};

export function useSaveReceived(churchId: string, fundraiserId: string, userId: string) {
  const refresh = useRefresh(churchId);
  return useMutation({
    mutationFn: async ({ id, input }: { id: string | null; input: ReceivedInput }) => {
      const { error } = id
        ? await supabase.from('fundraiser_entries').update(input).eq('id', id)
        : await supabase
            .from('fundraiser_entries')
            .insert({ fundraiser_id: fundraiserId, church_id: churchId, kind: 'received', created_by: userId, ...input });
      if (error) throw error;
    },
    onSuccess: refresh,
  });
}

export function useDeleteEntry(churchId: string) {
  const refresh = useRefresh(churchId);
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('fundraiser_entries').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: refresh,
  });
}
