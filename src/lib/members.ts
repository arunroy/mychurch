import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Linking from 'expo-linking';

import type { Membership, MemberRole, Profile } from './database.types';
import { supabase } from './supabase';

export type Member = Membership & { profile: Profile | null };

export function memberName(member: Member) {
  return member.profile?.full_name || 'Church member';
}

export function useMembers(churchId: string) {
  return useQuery({
    queryKey: ['members', churchId],
    queryFn: async (): Promise<Member[]> => {
      const { data, error } = await supabase
        .from('memberships')
        .select('*, profile:profiles(*)')
        .eq('church_id', churchId)
        .order('created_at');
      if (error) throw error;
      return data.sort((a, b) => (a.profile?.full_name ?? '').localeCompare(b.profile?.full_name ?? ''));
    },
  });
}

function useMemberAction<Args>(churchId: string, action: (args: Args) => PromiseLike<{ error: unknown }>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: Args) => {
      const { error } = await action(args);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['members', churchId] }),
  });
}

export function useApproveMember(churchId: string) {
  return useMemberAction(churchId, (userId: string) =>
    supabase.rpc('approve_member', { p_church: churchId, p_user: userId }),
  );
}

export function useRemoveMember(churchId: string) {
  return useMemberAction(churchId, (userId: string) =>
    supabase.rpc('remove_member', { p_church: churchId, p_user: userId }),
  );
}

export function useSetRole(churchId: string) {
  return useMemberAction(churchId, ({ userId, role }: { userId: string; role: MemberRole }) =>
    supabase.rpc('set_member_role', { p_church: churchId, p_user: userId, p_role: role }),
  );
}

export function useJoinCode(churchId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['join-code', churchId],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('church_join_codes')
        .select('code')
        .eq('church_id', churchId)
        .maybeSingle();
      if (error) throw error;
      return data?.code ?? null;
    },
  });
}

export function inviteLink(code: string) {
  return Linking.createURL('/join', { queryParams: { code } });
}

export function inviteMessage(churchName: string, code: string) {
  return (
    `Join ${churchName} on MyChurch. Download the MyChurch app and enter the code ${code}, ` +
    `or open this link on your phone: ${inviteLink(code)}`
  );
}
