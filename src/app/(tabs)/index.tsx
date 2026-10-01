import { router } from 'expo-router';

import { AnnouncementCards } from '@/components/announcement-cards';
import { ChurchHeader } from '@/components/church-header';
import { HomeShortcuts } from '@/components/home-shortcuts';
import { InviteCard } from '@/components/invite-card';
import { SpecialDaysCard } from '@/components/special-days-card';
import { VerseCard } from '@/components/verse-card';
import { Button, Card, Heading, Screen } from '@/components/ui';
import { useProfile } from '@/lib/auth';
import { useActiveChurch, usePermissions } from '@/lib/church';
import { useMembers } from '@/lib/members';

export default function HomeScreen() {
  const profile = useProfile();
  const active = useActiveChurch();
  const { isLeader } = usePermissions();
  const members = useMembers(active.church_id);
  const pending = members.data?.filter((m) => m.status === 'pending') ?? [];
  const approvedCount = members.data?.filter((m) => m.status === 'approved').length ?? 0;
  const firstName = profile.data?.full_name.split(' ')[0];

  return (
    <Screen edges={['top']}>
      <ChurchHeader />

      <Card>
        <Heading>Welcome, {firstName}</Heading>
      </Card>

      <AnnouncementCards />

      <VerseCard />

      <SpecialDaysCard />

      <HomeShortcuts />

      {isLeader && pending.length > 0 ? (
        <Card>
          <Heading>
            {pending.length === 1 ? '1 person wants to join' : `${pending.length} people want to join`}
          </Heading>
          <Button title="Review requests" onPress={() => router.push('/members')} />
        </Card>
      ) : null}

      {isLeader && approvedCount <= 1 ? <InviteCard /> : null}
    </Screen>
  );
}
