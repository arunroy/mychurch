import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Heading, useAccent } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useActiveChurch, usePermissions } from '@/lib/church';
import { useIsPlatformAdmin } from '@/lib/auth';
import { useMembers } from '@/lib/members';
import { useOpenReportCount } from '@/lib/reports';
import { useUnansweredCount } from '@/lib/qa';
import { usePendingSermonCount } from '@/lib/sermons';

type Shortcut = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  path: '/members' | '/reports' | '/qa' | '/sermons' | '/prayer' | '/polls' | '/daily-verse' | '/announcements' | '/church-settings';
  badge?: number;
  show: boolean;
};

/** Big tappable tiles for the things people do most, each shown only to the people who can use it. */
export function HomeShortcuts() {
  const { church_id } = useActiveChurch();
  const { isLeader, isPastor, canEditChurch } = usePermissions();
  const members = useMembers(church_id);
  const pending = isLeader ? (members.data?.filter((m) => m.status === 'pending').length ?? 0) : 0;
  const unanswered = useUnansweredCount(church_id, isPastor);
  const sermonsToReview = usePendingSermonCount(church_id, isPastor);
  const isPlatformAdmin = useIsPlatformAdmin().data === true;
  const reportsToReview = useOpenReportCount(church_id, isLeader, isPlatformAdmin);

  const shortcuts: Shortcut[] = [
    { label: 'Members', icon: 'people', path: '/members', badge: pending, show: true },
    { label: 'Sermons', icon: 'mic', path: '/sermons', badge: sermonsToReview, show: true },
    { label: 'Questions & answers', icon: 'help-circle', path: '/qa', badge: unanswered, show: true },
    { label: 'Prayer requests', icon: 'heart', path: '/prayer', show: true },
    { label: 'Polls', icon: 'stats-chart', path: '/polls', show: true },
    { label: 'Daily verse', icon: 'book', path: '/daily-verse', show: isPastor },
    { label: 'Reports', icon: 'flag', path: '/reports', badge: reportsToReview, show: isLeader || isPlatformAdmin },
    { label: 'Announcements', icon: 'megaphone', path: '/announcements', show: isLeader },
    { label: 'Church settings', icon: 'settings', path: '/church-settings', show: canEditChurch },
  ];

  return (
    <View style={styles.section}>
      <Heading>Church</Heading>
      <View style={styles.grid}>
        {shortcuts
          .filter((s) => s.show)
          .map((s) => (
            <Tile key={s.path} shortcut={s} />
          ))}
      </View>
    </View>
  );
}

function Tile({ shortcut }: { shortcut: Shortcut }) {
  const theme = useTheme();
  const accent = useAccent();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={shortcut.badge ? `${shortcut.label}, ${shortcut.badge} waiting` : shortcut.label}
      onPress={() => router.push(shortcut.path)}
      style={({ pressed }) => [styles.tile, { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.7 : 1 }]}>
      <View style={[styles.iconCircle, { backgroundColor: accent }]}>
        <Ionicons name={shortcut.icon} size={26} color="#FFFFFF" />
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
