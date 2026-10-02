import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { AnnouncementCards } from '@/components/announcement-cards';
import { ChurchHeader } from '@/components/church-header';
import { FeaturesPrompt } from '@/components/features-card';
import { HomeShortcuts } from '@/components/home-shortcuts';
import { InviteCard } from '@/components/invite-card';
import { SosBanner } from '@/components/sos-banner';
import { SpecialDaysCard } from '@/components/special-days-card';
import { VerseCard } from '@/components/verse-card';
import { WorshipCard } from '@/components/worship-card';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Card, Heading, Screen } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useProfile } from '@/lib/auth';
import { useActiveChurch, usePermissions } from '@/lib/church';
import { useEnabledFeatures } from '@/lib/features';
import { dateKey, formatDay } from '@/lib/dates';
import { useMembers } from '@/lib/members';

export default function HomeScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const profile = useProfile();
  const active = useActiveChurch();
  const { isLeader } = usePermissions();
  const members = useMembers(active.church_id);
  const pending = members.data?.filter((m) => m.status === 'pending') ?? [];
  const approvedCount = members.data?.filter((m) => m.status === 'approved').length ?? 0;
  const featureOn = useEnabledFeatures();
  const firstName = profile.data?.full_name.split(' ')[0];

  return (
    <Screen edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.greeting, { color: theme.textSecondary }]}>
          {t(greetingKey(), { name: firstName })} · {formatDay(dateKey())}
        </Text>
        <ChurchHeader />
      </View>

      <SosBanner />

      <FeaturesPrompt />

      {featureOn('announcements') ? <AnnouncementCards /> : null}

      {featureOn('daily_verse') ? <VerseCard /> : null}

      {featureOn('worship') ? <WorshipCard /> : null}

      {featureOn('special_days') ? <SpecialDaysCard /> : null}

      <HomeShortcuts />

      {isLeader && pending.length > 0 ? (
        <Card>
          <Heading>{t('home.wantToJoin', { count: pending.length })}</Heading>
          <Button title={t('home.reviewRequests')} onPress={() => router.push('/members')} />
        </Card>
      ) : null}

      {isLeader && approvedCount <= 1 ? <InviteCard /> : null}
    </Screen>
  );
}

/** Good morning until noon, good afternoon until 5 PM, then good evening. */
function greetingKey() {
  const hour = new Date().getHours();
  return hour < 12 ? 'home.goodMorning' : hour < 17 ? 'home.goodAfternoon' : 'home.goodEvening';
}

const styles = StyleSheet.create({
  header: { gap: 2, marginTop: 4 },
  greeting: { fontSize: 15, fontWeight: 500 },
});
