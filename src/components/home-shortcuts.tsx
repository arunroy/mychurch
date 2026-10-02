import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { CountBadge, ListSection, Row } from '@/components/ui';
import { IconColors } from '@/constants/theme';
import { useActiveChurch, usePermissions } from '@/lib/church';
import { useIsPlatformAdmin } from '@/lib/auth';
import { useMembers } from '@/lib/members';
import { useEnabledFeatures, type FeatureKey } from '@/lib/features';
import { useFundraisers } from '@/lib/fundraisers';
import { useIsWorshipTime, useWorshipPlans } from '@/lib/worship';
import { useUnseenVideoCount } from '@/lib/video-seen';
import { useOpenReportCount } from '@/lib/reports';
import { useUnansweredCount } from '@/lib/qa';
import { usePendingSermonCount } from '@/lib/sermons';

type Shortcut = {
  label: string;
  /** An Ionicons name, or a Material Community icon for the few things Ionicons has no picture of (praying hands). */
  icon: keyof typeof Ionicons.glyphMap | { material: keyof typeof MaterialCommunityIcons.glyphMap };
  /** The colour of the square behind the icon. */
  color: keyof typeof IconColors;
  path: '/bible' | '/fasting' | '/worship' | '/worship-planner' | '/fundraisers' | '/funds' | '/videos' | '/bible-study' | '/special-days' | '/members' | '/reports' | '/qa' | '/sermons' | '/prayer' | '/polls' | '/daily-verse' | '/announcements' | '/church-settings';
  badge?: number;
  /** The switch the Pastor must turn on for this row. Without one, the row is always available. */
  feature?: FeatureKey;
  show: boolean;
};

/**
 * The church's features as grouped lists, like the phone's own Settings: what everyone uses, then the tools for
 * leaders. Each row shows only to the people who can use it, and only when the Pastor has turned its feature on.
 */
export function HomeShortcuts() {
  const { t } = useTranslation();
  const { church_id, church } = useActiveChurch();
  const { isLeader, isPastor, canEditChurch, canSeeFunds, canRunFundraisers, canPlanWorship } = usePermissions();
  const members = useMembers(church_id);
  const pending = isLeader ? (members.data?.filter((m) => m.status === 'pending').length ?? 0) : 0;
  const unanswered = useUnansweredCount(church_id, isPastor);
  const sermonsToReview = usePendingSermonCount(church_id, isPastor);
  const isPlatformAdmin = useIsPlatformAdmin().data === true;
  const reportsToReview = useOpenReportCount(church_id, isLeader, isPlatformAdmin);

  const featureOn = useEnabledFeatures();
  const fundraisers = useFundraisers(church.id);
  const worshipPlans = useWorshipPlans(church.id);
  const worshipTime = useIsWorshipTime();
  const hasWorship = worshipTime && (worshipPlans.data?.length ?? 0) > 0;
  const hasFundraisers = (fundraisers.data?.length ?? 0) > 0;
  const newVideos = useUnseenVideoCount(church.id, church.youtube_channel_id);

  const everyone: Shortcut[] = [
    { label: t('shortcuts.bible'), icon: 'book-outline', color: 'blue', path: '/bible', feature: 'bible', show: true },
    // Everyone sees Worship on Sunday until 6 PM, once something is planned.
    { label: t('shortcuts.worship'), icon: 'musical-notes-outline', color: 'purple', path: '/worship', feature: 'worship', show: hasWorship },
    { label: t('shortcuts.prayer'), icon: { material: 'hands-pray' }, color: 'pink', path: '/prayer', feature: 'prayer', show: true },
    { label: t('shortcuts.fasting'), icon: 'time-outline', color: 'orange', path: '/fasting', feature: 'fasting', show: true },
    { label: t('shortcuts.sermons'), icon: 'document-text-outline', color: 'green', path: '/sermons', badge: sermonsToReview, feature: 'sermons', show: true },
    // Everyone sees Videos once the church has a channel; the people who can add one see it to be reminded to.
    { label: t('shortcuts.videos'), icon: 'play-outline', color: 'red', path: '/videos', badge: newVideos, feature: 'videos', show: !!church.youtube_channel_id || canEditChurch },
    { label: t('shortcuts.bibleStudy'), icon: 'school-outline', color: 'indigo', path: '/bible-study', feature: 'bible_study', show: true },
    { label: t('shortcuts.qa'), icon: 'help-outline', color: 'orange', path: '/qa', badge: unanswered, feature: 'qa', show: true },
    { label: t('shortcuts.polls'), icon: 'stats-chart-outline', color: 'amber', path: '/polls', feature: 'polls', show: true },
    // Everyone sees Fundraisers once one exists; the Pastor and elders always, to open the first.
    { label: t('shortcuts.fundraisers'), icon: 'heart-outline', color: 'pink', path: '/fundraisers', feature: 'fundraisers', show: hasFundraisers || canRunFundraisers },
    { label: t('shortcuts.members'), icon: 'people-outline', color: 'teal', path: '/members', badge: pending, show: true },
  ];

  const leaders: Shortcut[] = [
    { label: t('shortcuts.announcements'), icon: 'megaphone-outline', color: 'cyan', path: '/announcements', feature: 'announcements', show: isLeader },
    { label: t('shortcuts.dailyVerse'), icon: 'reader-outline', color: 'brown', path: '/daily-verse', feature: 'daily_verse', show: isPastor },
    { label: t('shortcuts.worshipPlanner'), icon: 'calendar-outline', color: 'purple', path: '/worship-planner', feature: 'worship', show: canPlanWorship },
    { label: t('shortcuts.specialDays'), icon: 'gift-outline', color: 'orange', path: '/special-days', feature: 'special_days', show: isLeader },
    { label: t('shortcuts.funds'), icon: 'cash-outline', color: 'green', path: '/funds', feature: 'funds', show: canSeeFunds },
    { label: t('shortcuts.reports'), icon: 'flag-outline', color: 'gray', path: '/reports', badge: reportsToReview, feature: 'reports', show: isLeader || isPlatformAdmin },
    { label: t('shortcuts.churchSettings'), icon: 'settings-outline', color: 'gray', path: '/church-settings', show: canEditChurch },
  ];

  const visible = (list: Shortcut[]) => list.filter((s) => s.show && (!s.feature || featureOn(s.feature)));

  return (
    <>
      <ListSection title={t('home.churchSection')} inset={44}>
        {visible(everyone).map((s) => (
          <ShortcutRow key={s.path} shortcut={s} />
        ))}
      </ListSection>
      <ListSection title={t('home.leadersSection')} inset={44}>
        {visible(leaders).map((s) => (
          <ShortcutRow key={s.path} shortcut={s} />
        ))}
      </ListSection>
    </>
  );
}

function ShortcutRow({ shortcut }: { shortcut: Shortcut }) {
  return (
    <Row
      title={shortcut.label}
      left={
        <View style={[styles.square, { backgroundColor: IconColors[shortcut.color] }]}>
          {typeof shortcut.icon === 'string' ? (
            <Ionicons name={shortcut.icon} size={18} color="#FFFFFF" />
          ) : (
            <MaterialCommunityIcons name={shortcut.icon.material} size={19} color="#FFFFFF" />
          )}
        </View>
      }
      right={shortcut.badge ? <CountBadge count={shortcut.badge} /> : undefined}
      onPress={() => router.push(shortcut.path)}
    />
  );
}

const styles = StyleSheet.create({
  square: { width: 30, height: 30, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
});
