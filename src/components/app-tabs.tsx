import { Ionicons } from '@expo/vector-icons';
import { TabList, TabSlot, TabTrigger, Tabs, type TabTriggerSlotProps } from 'expo-router/ui';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAccentText } from '@/components/ui';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useEnabledFeatures } from '@/lib/features';
import { TAB_BAR_CONTENT_HEIGHT } from '@/lib/tab-bar';

type IconName = keyof typeof Ionicons.glyphMap;

/**
 * The bottom menu, drawn by the app rather than the system so it can be roomy: big icons, clear
 * labels and a highlighted pill on the open tab. Badges show leaders' waiting requests on Home,
 * unread chat messages and unread private messages.
 */
export default function AppTabs({
  pendingCount,
  unreadCount,
  chatUnread,
}: {
  pendingCount: number;
  unreadCount: number;
  chatUnread: number;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  // Calendar, Chat and Messages appear only when the Pastor has turned them on.
  const featureOn = useEnabledFeatures();

  return (
    <Tabs>
      <TabSlot style={styles.slot} />
      <TabList
        style={[
          styles.list,
          {
            backgroundColor: theme.backgroundElement,
            borderTopColor: theme.backgroundSelected,
            height: TAB_BAR_CONTENT_HEIGHT + insets.bottom,
            paddingBottom: insets.bottom,
          },
        ]}>
        <TabTrigger name="index" href="/" asChild>
          <TabButton label={t('tabs.home')} icon="home-outline" activeIcon="home" badge={pendingCount} />
        </TabTrigger>
        {featureOn('calendar') ? (
          <TabTrigger name="calendar" href="/calendar" asChild>
            <TabButton label={t('tabs.calendar')} icon="calendar-outline" activeIcon="calendar" />
          </TabTrigger>
        ) : null}
        {featureOn('chat') ? (
          <TabTrigger name="chat" href="/chat" asChild>
            <TabButton label={t('tabs.chat')} icon="people-outline" activeIcon="people" badge={chatUnread} />
          </TabTrigger>
        ) : null}
        {featureOn('messages') ? (
          <TabTrigger name="messages" href="/messages" asChild>
            <TabButton label={t('tabs.messages')} icon="mail-outline" activeIcon="mail" badge={unreadCount} />
          </TabTrigger>
        ) : null}
        <TabTrigger name="more" href="/more" asChild>
          <TabButton label={t('tabs.more')} icon="ellipsis-horizontal-circle-outline" activeIcon="ellipsis-horizontal-circle" />
        </TabTrigger>
      </TabList>
    </Tabs>
  );
}

function TabButton({
  label,
  icon,
  activeIcon,
  badge = 0,
  isFocused,
  ...props
}: TabTriggerSlotProps & { label: string; icon: IconName; activeIcon: IconName; badge?: number }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const accentText = useAccentText();
  const color = isFocused ? accentText : theme.textSecondary;

  return (
    <Pressable
      {...props}
      accessibilityRole="tab"
      accessibilityState={{ selected: !!isFocused }}
      accessibilityLabel={badge > 0 ? t('tabs.newBadge', { label, count: badge }) : label}
      style={styles.button}>
      <View style={[styles.pill, isFocused ? { backgroundColor: theme.backgroundSelected } : null]}>
        <Ionicons name={isFocused ? activeIcon : icon} size={30} color={color} />
        {badge > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.label, { color, fontWeight: isFocused ? 700 : 500 }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  slot: { flex: 1 },
  list: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingTop: Spacing.two,
  },
  button: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  pill: { width: 64, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 13 },
  badge: {
    position: 'absolute',
    top: -2,
    right: 4,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: '#D92D20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: 700 },
});
