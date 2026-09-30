import { router } from 'expo-router';

import { AnnouncementCards } from '@/components/announcement-cards';
import { ChurchHeader } from '@/components/church-header';
import { InviteCard } from '@/components/invite-card';
import { VerseCard } from '@/components/verse-card';
import { Body, Button, Card, Heading, Screen } from '@/components/ui';
import { useProfile } from '@/lib/auth';
import { ROLE_LABELS, useActiveChurch, usePermissions } from '@/lib/church';
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
        <Body muted>
          You&apos;re {active.role === 'member' ? 'a member' : `the ${ROLE_LABELS[active.role]}`} here.
          {approvedCount > 1 ? ` ${approvedCount} people are part of this church on MyChurch.` : ''}
        </Body>
      </Card>

      <AnnouncementCards />

      <VerseCard />

      {isLeader && pending.length > 0 ? (
        <Card>
          <Heading>
            {pending.length === 1 ? '1 person wants to join' : `${pending.length} people want to join`}
          </Heading>
          <Button title="Review requests" onPress={() => router.push('/members')} />
        </Card>
      ) : null}

      {isLeader && approvedCount <= 1 ? <InviteCard /> : null}

      <Card>
        <Heading>Coming soon</Heading>
        <Body muted>Announcements and sermons will appear here.</Body>
      </Card>
    </Screen>
  );
}
