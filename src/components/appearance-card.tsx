import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Body, Card, Chip, Heading, useAccent } from '@/components/ui';
import { GRADIENTS, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemePreference, type ThemePreference } from '@/lib/theme-preference';

const MODES: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

/** Light, dark or system, and one of six background gradients (or none). Saved on this device. */
export function AppearanceCard() {
  const theme = useTheme();
  const { preference, setPreference, scheme, gradient, setGradient } = useThemePreference();

  return (
    <Card>
      <Heading>Appearance</Heading>

      <View style={styles.chips}>
        {MODES.map((mode) => (
          <Chip key={mode.value} label={mode.label} selected={preference === mode.value} onPress={() => setPreference(mode.value)} />
        ))}
      </View>
      <Body muted>System follows your phone&apos;s light or dark setting.</Body>

      <Heading>Background</Heading>
      <View style={styles.swatches}>
        <Swatch name="Plain" selected={gradient === null} onPress={() => setGradient(null)}>
          <View style={[styles.fill, { backgroundColor: scheme === 'dark' ? '#000000' : '#FFFFFF', borderColor: theme.backgroundSelected, borderWidth: 1 }]} />
        </Swatch>
        {GRADIENTS.map((g) => (
          <Swatch key={g.id} name={g.name} selected={gradient === g.id} onPress={() => setGradient(g.id)}>
            <LinearGradient colors={[...g[scheme]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fill} />
          </Swatch>
        ))}
      </View>
    </Card>
  );
}

function Swatch({
  name,
  selected,
  onPress,
  children,
}: {
  name: string;
  selected: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  const theme = useTheme();
  const accent = useAccent();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name} background`}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={styles.swatch}>
      <View style={[styles.frame, { borderColor: selected ? accent : 'transparent' }]}>{children}</View>
      <Text style={[styles.swatchName, { color: selected ? theme.text : theme.textSecondary, fontWeight: selected ? 700 : 400 }]}>{name}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  swatch: { width: 76, alignItems: 'center', gap: Spacing.one },
  frame: { width: 68, height: 68, borderRadius: 18, borderWidth: 3, padding: 2 },
  fill: { flex: 1, borderRadius: 14 },
  swatchName: { fontSize: 13 },
});
