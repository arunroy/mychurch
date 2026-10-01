import AppTabs from '@/components/app-tabs';
import { useActiveChurch, usePermissions } from '@/lib/church';
import { useAnonymousBadge } from '@/lib/anonymous';
import { useChatUnreadCount } from '@/lib/church-chat';
import { useEldersBadge } from '@/lib/elders';
import { useMembers } from '@/lib/members';
import { useInboxRealtime, useUnreadCount } from '@/lib/messages';

export default function TabLayout() {
  const { church_id } = useActiveChurch();
  const { isLeader, isPastor } = usePermissions();
  const members = useMembers(church_id);
  const pendingCount = isLeader ? (members.data?.filter((m) => m.status === 'pending').length ?? 0) : 0;
  useInboxRealtime(church_id);
  const eldersBadge = useEldersBadge(church_id, isLeader);
  const anonymousBadge = useAnonymousBadge(church_id, isPastor);
  const unreadCount = useUnreadCount(church_id) + eldersBadge + anonymousBadge;
  const chatUnread = useChatUnreadCount(church_id);
  return <AppTabs pendingCount={pendingCount} unreadCount={unreadCount} chatUnread={chatUnread} />;
}
