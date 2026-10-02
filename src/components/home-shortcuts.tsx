import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Heading, useAccent } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
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
  path: '/bible' | '/worship' | '/worship-planner' | '/fundraisers' | '/funds' | '/videos' | '/bible-study' | '/special-days' | '/members' | '/reports' | '/qa' | '/sermons' | '/prayer' | '/polls' | '/daily-verse' | '/announcements' | '/church-settings';
  badge?: number;
  /** The switch the Pastor must turn on for this tile. Without one, the tile is always available. */
  feature?: FeatureKey;
  show: boolean;
};

/** Big tappable tiles for the things people do most, each shown only to the people who can use it. */
export function HomeShortcuts() {
  const { t } = useTranslation();
  const { church_id } = useActiveChurch();
  const { isLeader, isPastor, canEditChurch, canSeeFunds, canRunFundraisers, canPlanWorship } = usePermissions();
  const members = useMembers(church_id);
  const pending = isLeader ? (members.data?.filter((m) => m.status === 'pending').length ?? 0) : 0;
  const unanswered = useUnansweredCount(church_id, isPastor);
  const sermonsToReview = usePendingSermonCount(church_id, isPastor);
  const isPlatformAdmin = useIsPlatformAdmin().data === true;
  const reportsToReview = useOpenReportCount(church_id, isLeader, isPlatformAdmin);

  const { church } = useActiveChurch();
  const featureOn = useEnabledFeatures();
  const fundraisers = useFundraisers(church.id);
  const worshipPlans = useWorshipPlans(church.id);
  const worshipTime = useIsWorshipTime();
  const hasWorship = worshipTime && (worshipPlans.data?.length ?? 0) > 0;
  const hasFundraisers = (fundraisers.data?.length ?? 0) > 0;
  const newVideos = useUnseenVideoCount(church.id, church.youtube_channel_id);
  const shortcuts: Shortcut[] = [
    { label: t('shortcuts.bible'), icon: 'book-outline', path: '/bible', feature: 'bible', show: true },
    // Everyone sees Videos once the church has a channel; the people who can add one see it to be reminded to.
    { label: t('shortcuts.videos'), icon: 'logo-youtube', path: '/videos', badge: newVideos, feature: 'videos', show: !!church.youtube_channel_id || canEditChurch },
    // Everyone sees Worship on Sunday until 6 PM, once something is planned.
    { label: t('shortcuts.worship'), icon: 'musical-notes', path: '/worship', feature: 'worship', show: hasWorship },
    { label: t('shortcuts.bibleStudy'), icon: 'school', path: '/bible-study', feature: 'bible_study', show: true },
    { label: t('shortcuts.members'), icon: 'people', path: '/members', badge: pending, show: true },
    { label: t('shortcuts.sermons'), icon: 'document-text', path: '/sermons', badge: sermonsToReview, feature: 'sermons', show: true },
    { label: t('shortcuts.qa'), icon: 'help-circle', path: '/qa', badge: unanswered, feature: 'qa', show: true },
    { label: t('shortcuts.prayer'), icon: { material: 'hands-pray' }, path: '/prayer', feature: 'prayer', show: true },
    { label: t('shortcuts.polls'), icon: 'stats-chart', path: '/polls', feature: 'polls', show: true },
    { label: t('shortcuts.dailyVerse'), icon: 'book', path: '/daily-verse', feature: 'daily_verse', show: isPastor },
    { label: t('shortcuts.reports'), icon: 'flag', path: '/reports', badge: reportsToReview, feature: 'reports', show: isLeader || isPlatformAdmin },
    { label: t('shortcuts.specialDays'), icon: 'gift', path: '/special-days', feature: 'special_days', show: isLeader },
    { label: t('shortcuts.funds'), icon: 'cash', path: '/funds', feature: 'funds', show: canSeeFunds },
    // Everyone sees Fundraisers once one exists; the Pastor and elders always, to open the first.
    { label: t('shortcuts.fundraisers'), icon: 'heart', path: '/fundraisers', feature: 'fundraisers', show: hasFundraisers || canRunFundraisers },
    { label: t('shortcuts.worshipPlanner'), icon: 'calendar', path: '/worship-planner', feature: 'worship', show: canPlanWorship },
    { label: t('shortcuts.announcements'), icon: 'megaphone', path: '/announcements', feature: 'announcements', show: isLeader },
    { label: t('shortcuts.churchSettings'), icon: 'settings', path: '/church-settings', show: canEditChurch },
  ];

  return (
    <View style={styles.section}>
      <Heading>{t('home.churchSection')}</Heading>
      <View style={styles.grid}>
        {shortcuts
          .filter((s) => s.show && (!s.feature || featureOn(s.feature)))
          .map((s) => (
            <Tile key={s.path} shortcut={s} />
          ))}
      </View>
    </View>
  );
}

function Tile({ shortcut }: { shortcut: Shortcut }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const accent = useAccent();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={shortcut.badge ? t('shortcuts.waiting', { label: shortcut.label, count: shortcut.badge }) : shortcut.label}
      onPress={() => router.push(shortcut.path)}
      style={({ pressed }) => [styles.tile, { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.7 : 1 }]}>
      <View style={[styles.iconCircle, { backgroundColor: accent }]}>
        {typeof shortcut.icon === 'string' ? (
          <Ionicons name={shortcut.icon} size={26} color="#FFFFFF" />
        ) : (
          <MaterialCommunityIcons name={shortcut.icon.material} size={28} color="#FFFFFF" />
        )}
        {shortcut.badge ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{shortcut.badge > 99 ? '99+' : shortcut.badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.label, { color: theme.text }]} numberOfLines={2}>
        {shortcut.label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.two },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  tile: {
    flexGrow: 1,
    flexBasis: '42%',
    minHeight: 112,
    borderRadius: 20,
    padding: Spacing.three,
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  iconCircle: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 17, fontWeight: 600 },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 5,
    backgroundColor: '#D92D20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: 700 },
});
