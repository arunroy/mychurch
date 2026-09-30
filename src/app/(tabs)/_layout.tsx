import AppTabs from '@/components/app-tabs';
import { useActiveChurch, usePermissions } from '@/lib/church';
import { useChatUnreadCount } from '@/lib/church-chat';
import { useMembers } from '@/lib/members';
import { useInboxRealtime, useUnreadCount } from '@/lib/messages';

export default function TabLayout() {
  const { church_id } = useActiveChurch();
  const { isLeader } = usePermissions();
  const members = useMembers(church_id);
  const pendingCount = isLeader ? (members.data?.filter((m) => m.status === 'pending').length ?? 0) : 0;
  useInboxRealtime(church_id);
  const unreadCount = useUnreadCount(church_id);
  const chatUnread = useChatUnreadCount(church_id);
  return <AppTabs pendingCount={pendingCount} unreadCount={unreadCount} chatUnread={chatUnread} />;
}
