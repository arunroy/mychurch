import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { InviteCard } from '@/components/invite-card';
import { Avatar, Body, Card, Chip, Heading, Row, Screen, Title } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { signOut, useIsPlatformAdmin, useProfile } from '@/lib/auth';
import { ROLE_LABELS, useActiveChurch, useChurch, usePermissions } from '@/lib/church';
import { confirm } from '@/lib/confirm';
import { useMembers } from '@/lib/members';
import { publicUrl } from '@/lib/supabase';
import { useThemePreference, type ThemePreference } from '@/lib/theme-preference';

const THEME_CHOICES: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export default function MoreScreen() {
  const { preference: themePreference, setPreference: setThemePreference } = useThemePreference();
  const profile = useProfile();
  const active = useActiveChurch();
  const { memberships } = useChurch();
  const { canEditChurch, isPastor, isLeader } = usePermissions();
  const members = useMembers(active.church_id);
  const pendingCount = isLeader ? (members.data?.filter((m) => m.status === 'pending').length ?? 0) : 0;
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

      <InviteCard />

      <Card>
        <Row
          title="Members"
          subtitle={pendingCount > 0 ? `${pendingCount} waiting to join` : undefined}
          onPress={() => router.push('/members')}
        />
        <Row title="Polls" subtitle="Ask the church a question, or vote" onPress={() => router.push('/polls')} />
        {isLeader ? (
          <Row title="Announcements" subtitle="Post a notice on everyone's Home screen" onPress={() => router.push('/announcements')} />
        ) : null}
        {isPastor ? (
          <Row title="Daily verse" subtitle="Choose and schedule the verse and reflection" onPress={() => router.push('/daily-verse')} />
        ) : null}
        {canEditChurch ? <Row title="Church settings" onPress={() => router.push('/church-settings')} /> : null}
        {memberships.length > 1 ? (
          <Row title="Switch church" subtitle={`You belong to ${memberships.length}`} onPress={() => router.push('/switch-church')} />
        ) : null}
        <Row title="Join another church" onPress={() => router.push('/join')} />
        <Row title="Register a church" onPress={() => router.push('/register')} />
        {isPlatformAdmin.data ? <Row title="Verify churches" onPress={() => router.push('/review-churches')} /> : null}
      </Card>

      <Card>
        <Heading>Appearance</Heading>
        <View style={styles.chips}>
          {THEME_CHOICES.map((choice) => (
            <Chip
              key={choice.value}
              label={choice.label}
              selected={themePreference === choice.value}
              onPress={() => setThemePreference(choice.value)}
            />
          ))}
        </View>
        <Body muted>System follows your phone&apos;s light or dark setting.</Body>
      </Card>

      <Card>
        <Row title="Sign out" onPress={() => confirm('Sign out?', 'You can sign back in with your email any time.', 'Sign out', signOut)} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
