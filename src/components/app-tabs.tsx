import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { useAccent } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';

export default function AppTabs({ pendingCount }: { pendingCount: number }) {
  const theme = useTheme();
  const accent = useAccent();

  return (
    <NativeTabs
      backgroundColor={theme.background}
      tintColor={accent}
      indicatorColor={theme.backgroundElement}
      labelStyle={{ selected: { color: theme.text } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="members">
        <NativeTabs.Trigger.Label>Members</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'person.2', selected: 'person.2.fill' }} md="group" />
        {pendingCount > 0 ? <NativeTabs.Trigger.Badge>{String(pendingCount)}</NativeTabs.Trigger.Badge> : null}
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="more">
        <NativeTabs.Trigger.Label>More</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="ellipsis.circle" md="more_horiz" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
