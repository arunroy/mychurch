import { TabList, TabSlot, TabTrigger, Tabs, type TabTriggerSlotProps } from 'expo-router/ui';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAccent } from '@/components/ui';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// The web has no native tab bar, so draw a simple one along the bottom.
export default function AppTabs({ pendingCount, unreadCount }: { pendingCount: number; unreadCount: number }) {
  const theme = useTheme();
  return (
    <Tabs>
      <TabSlot style={styles.slot} />
      <TabList style={[styles.list, { backgroundColor: theme.background, borderTopColor: theme.backgroundSelected }]}>
        <TabTrigger name="index" href="/" asChild>
          <TabButton label="Home" />
        </TabTrigger>
        <TabTrigger name="calendar" href="/calendar" asChild>
          <TabButton label="Calendar" />
        </TabTrigger>
        <TabTrigger name="chat" href="/chat" asChild>
          <TabButton label="Chat" />
        </TabTrigger>
        <TabTrigger name="messages" href="/messages" asChild>
          <TabButton label={unreadCount > 0 ? `Messages (${unreadCount})` : 'Messages'} />
        </TabTrigger>
        <TabTrigger name="more" href="/more" asChild>
          <TabButton label={pendingCount > 0 ? `More (${pendingCount})` : 'More'} />
        </TabTrigger>
      </TabList>
    </Tabs>
  );
}

function TabButton({ label, isFocused, ...props }: TabTriggerSlotProps & { label: string }) {
  const theme = useTheme();
  const accent = useAccent();
  return (
    <Pressable {...props} style={styles.button}>
      <View>
        <Text style={[styles.label, { color: isFocused ? accent : theme.textSecondary }]}>{label}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  slot: { flex: 1 },
  list: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.two,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  button: { flex: 1, alignItems: 'center', paddingVertical: Spacing.two },
  label: { fontSize: 15, fontWeight: 600 },
});
