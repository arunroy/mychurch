import { Stack, useLocalSearchParams } from 'expo-router';

import { ElderThread } from '@/components/elder-thread';
import { useUserId } from '@/lib/auth';
import { useActiveChurch, usePermissions } from '@/lib/church';

// One thread with the elders. A leader opens a member's thread to read and reply; a member opening a
// notification lands in their own thread. The database only lets those people in.
export default function EldersThreadScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const { church_id } = useActiveChurch();
  const { isLeader } = usePermissions();
  const userId = useUserId();
  if (!userId) return null;

  return (
    <>
      <Stack.Screen options={{ title: isLeader ? (name ?? 'Elders thread') : 'The elders' }} />
      <ElderThread churchId={church_id} userId={userId} threadId={id} asLeader={isLeader} />
    </>
  );
}
