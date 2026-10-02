import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { ChatGroup, ChatGroupMember, ManageableChatGroup } from './database.types';
import { supabase } from './supabase';

/** The groups the person is in, for the chips above the chat. */
export function useMyChatGroups(churchId: string) {
  return useQuery({
    queryKey: ['chat-groups', churchId, 'mine'],
    queryFn: async (): Promise<ChatGroup[]> => {
      const { data, error } = await supabase.rpc('my_chat_groups', { p_church: churchId });
      if (error) throw error;
      return data;
    },
  });
}

/** Every group in the church, for the Pastor and elders who manage them. Names and sizes only. */
export function useManageableChatGroups(churchId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['chat-groups', churchId, 'manage'],
    enabled,
    retry: false,
    queryFn: async (): Promise<ManageableChatGroup[]> => {
      const { data, error } = await supabase.rpc('manageable_chat_groups', { p_church: churchId });
      if (error) throw error;
      return data;
    },
  });
}

/** Who is in a group. Group members and the people who manage groups can ask. */
export function useChatGroupMembers(groupId: string | null) {
  return useQuery({
    queryKey: ['chat-group-members', groupId],
    enabled: !!groupId,
    retry: false,
    queryFn: async (): Promise<ChatGroupMember[]> => {
      const { data, error } = await supabase.rpc('chat_group_members_list', { p_group: groupId! });
      if (error) throw error;
      return data;
    },
  });
}

function useRefreshGroups(churchId: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['chat-groups', churchId] }),
      queryClient.invalidateQueries({ queryKey: ['chat-group-members'] }),
      queryClient.invalidateQueries({ queryKey: ['chat-unread', churchId] }),
      queryClient.invalidateQueries({ queryKey: ['church-chat', churchId] }),
    ]);
}

export type GroupInput = { name: string; description: string; members: string[] };

export function useCreateChatGroup(churchId: string) {
  const refresh = useRefreshGroups(churchId);
  return useMutation({
    mutationFn: async ({ name, description, members }: GroupInput) => {
      const { data, error } = await supabase.rpc('create_chat_group', {
        p_church: churchId,
        p_name: name,
        p_description: description,
        p_members: members,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: refresh,
  });
}

/** Changes a group's name and description, and who is in it. */
export function useUpdateChatGroup(churchId: string) {
  const refresh = useRefreshGroups(churchId);
  return useMutation({
    mutationFn: async ({ id, name, description, members }: GroupInput & { id: string }) => {
      const renamed = await supabase.rpc('update_chat_group', { p_group: id, p_name: name, p_description: description });
      if (renamed.error) throw renamed.error;
      const changed = await supabase.rpc('set_chat_group_members', { p_group: id, p_members: members });
      if (changed.error) throw changed.error;
    },
    onSuccess: refresh,
  });
}

export function useDeleteChatGroup(churchId: string) {
  const refresh = useRefreshGroups(churchId);
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('delete_chat_group', { p_group: id });
      if (error) throw error;
    },
    onSuccess: refresh,
  });
}
