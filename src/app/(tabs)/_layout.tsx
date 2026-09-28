import AppTabs from '@/components/app-tabs';
import { useActiveChurch, usePermissions } from '@/lib/church';
import { useMembers } from '@/lib/members';

export default function TabLayout() {
  const { church_id } = useActiveChurch();
  const { isLeader } = usePermissions();
  const members = useMembers(church_id);
  const pendingCount = isLeader ? (members.data?.filter((m) => m.status === 'pending').length ?? 0) : 0;
  return <AppTabs pendingCount={pendingCount} />;
}
