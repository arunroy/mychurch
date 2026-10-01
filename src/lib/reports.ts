import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { ReportItem, ReportReason, ReportTargetType } from './database.types';
import { supabase } from './supabase';

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'inappropriate', label: 'Inappropriate' },
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'spam', label: 'Spam' },
  { value: 'other', label: 'Something else' },
];

export const TARGET_LABELS: Record<ReportTargetType, string> = {
  chat_message: 'Church chat message',
  private_message: 'Private message',
  elders_message: 'Message in an elders thread',
  prayer_request: 'Prayer request',
  question: 'Question',
  poll: 'Poll',
  sermon: 'Sermon',
  event: 'Event',
  member: 'Member',
};

export function reasonLabel(reason: ReportReason) {
  return REPORT_REASONS.find((r) => r.value === reason)?.label ?? reason;
}

/** Reports a piece of content. Reporting the same thing twice is quietly ignored. */
export function useReportContent(churchId: string) {
  return useMutation({
    mutationFn: async ({
      type,
      targetId,
      reason,
      details,
    }: {
      type: ReportTargetType;
      targetId: string;
      reason: ReportReason;
      details: string;
    }) => {
      const { error } = await supabase.rpc('report_content', {
        p_church: churchId,
        p_type: type,
        p_target: targetId,
        p_reason: reason,
        p_details: details,
      });
      if (error) throw error;
    },
  });
}

/** The church's reports about members and their content, for its leaders. */
export function useReportQueue(churchId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['reports', churchId],
    enabled,
    refetchInterval: 60000,
    queryFn: async (): Promise<ReportItem[]> => {
      const { data, error } = await supabase.rpc('report_queue', { p_church: churchId });
      if (error) throw error;
      return data;
    },
  });
}

/** Reports about church leaders, for the app's administrators. */
export function usePlatformReportQueue(enabled: boolean) {
  return useQuery({
    queryKey: ['reports', 'platform'],
    enabled,
    refetchInterval: 60000,
    queryFn: async (): Promise<ReportItem[]> => {
      const { data, error } = await supabase.rpc('platform_report_queue');
      if (error) throw error;
      return data;
    },
  });
}

/** How many reports wait for this person, for the Home tile badge. */
export function useOpenReportCount(churchId: string, isLeader: boolean, isPlatformAdmin: boolean) {
  const church = useReportQueue(churchId, isLeader);
  const platform = usePlatformReportQueue(isPlatformAdmin);
  const open = (items?: ReportItem[]) => items?.filter((r) => r.status === 'open').length ?? 0;
  return open(church.data) + open(platform.data);
}

export function useResolveReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, dismiss, note }: { id: string; dismiss: boolean; note?: string }) => {
      const { error } = await supabase.rpc('resolve_report', { p_report: id, p_dismiss: dismiss, p_note: note ?? null });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reports'] }),
  });
}
