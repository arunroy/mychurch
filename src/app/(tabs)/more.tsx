import { router } from 'expo-router';

import { ThemeSettingsCard } from '@/components/theme-settings-card';
import { InviteCard } from '@/components/invite-card';
import { Avatar, Card, Row, Screen, Title } from '@/components/ui';
import { signOut, useIsPlatformAdmin, useProfile } from '@/lib/auth';
import { ROLE_LABELS, useActiveChurch, useChurch } from '@/lib/church';
import { confirm } from '@/lib/confirm';
import { publicUrl } from '@/lib/supabase';

// Your profile, theme settings and account. Church features (members, prayer, polls and so on) live on Home.
export default function MoreScreen() {
  const profile = useProfile();
  const active = useActiveChurch();
  const { memberships } = useChurch();
  const isPlatformAdmin = useIsPlatformAdmin();
  const name = profile.data?.full_name ?? '';

  return (
    <Screen edges={['top']}>
      <Title>More</Title>

      <Card>
        <Row
          title={name}
          subtitle={`${ROLE_LABELS[active.role]} at ${active.church.name}`}
          left={<Avatar name={name} uri={publicUrl('avatars', profile.data?.avatar_path)} />}
          onPress={() => router.push('/profile')}
        />
      </Card>

      <ThemeSettingsCard />

      <InviteCard />

      <Card>
        {memberships.length > 1 ? (
          <Row title="Switch church" subtitle={`You belong to ${memberships.length}`} onPress={() => router.push('/switch-church')} />
        ) : null}
        <Row title="Join another church" onPress={() => router.push('/join')} />
        <Row title="Register a church" onPress={() => router.push('/register')} />
        {isPlatformAdmin.data ? <Row title="Verify churches" onPress={() => router.push('/review-churches')} /> : null}
      </Card>

      <Card>
        <Row title="Sign out" onPress={() => confirm('Sign out?', 'You can sign back in with your email any time.', 'Sign out', signOut)} />
      </Card>
    </Screen>
  );
}
