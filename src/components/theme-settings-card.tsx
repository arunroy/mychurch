import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Body, Card, Chip, Heading, useAccentText } from '@/components/ui';
import { Colors, DEFAULT_ACCENT, Spacing, THEMES } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useChurch } from '@/lib/church';
import { useThemePreference, type ThemePreference } from '@/lib/theme-preference';

const MODES: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

/**
 * Light, dark or system, and a theme. A theme is a matched set of background, text and accent
 * colours, so every choice looks designed. Saved on this device.
 */
export function ThemeSettingsCard() {
  const { preference, setPreference, scheme, themeId, setThemeId } = useThemePreference();
  const churchColour = useChurch().active?.church.accent_color ?? DEFAULT_ACCENT;
  const plain = Colors[scheme];

  return (
    <Card>
      <Heading>Theme settings</Heading>

      <Body>Mode</Body>
      <View style={styles.chips}>
        {MODES.map((mode) => (
          <Chip key={mode.value} label={mode.label} selected={preference === mode.value} onPress={() => setPreference(mode.value)} />
        ))}
      </View>
      <Body muted>System follows your phone&apos;s light or dark setting.</Body>

      <Body>Theme</Body>
      <View style={styles.swatches}>
        <Swatch name="Plain" selected={themeId === null} onPress={() => setThemeId(null)}>
          <View style={[styles.preview, { backgroundColor: plain.background }]}>
            <Text style={[styles.aa, { color: plain.text }]}>Aa</Text>
            <View style={[styles.dot, { backgroundColor: churchColour }]} />
          </View>
        </Swatch>
        {THEMES.map((t) => {
          const palette = t[scheme];
          return (
            <Swatch key={t.id} name={t.name} selected={themeId === t.id} onPress={() => setThemeId(t.id)}>
              <LinearGradient colors={[...palette.gradient]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.preview}>
                <Text style={[styles.aa, { color: palette.text }]}>Aa</Text>
                <View style={[styles.dot, { backgroundColor: palette.accent }]} />
              </LinearGradient>
            </Swatch>
          );
        })}
      </View>
      <Body muted>Plain uses your church&apos;s own colour. Every other theme brings its own matching colours.</Body>
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
  const accentText = useAccentText();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name} theme`}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={styles.swatch}>
      <View style={[styles.frame, { borderColor: selected ? accentText : 'transparent' }]}>{children}</View>
      <Text style={[styles.swatchName, { color: selected ? theme.text : theme.textSecondary, fontWeight: selected ? 700 : 400 }]}>{name}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  swatch: { width: 76, alignItems: 'center', gap: Spacing.one },
  frame: { width: 68, height: 68, borderRadius: 18, borderWidth: 3, padding: 2 },
  preview: { flex: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 4, overflow: 'hidden' },
  aa: { fontSize: 18, fontWeight: 700 },
  dot: { width: 18, height: 8, borderRadius: 4 },
  swatchName: { fontSize: 13 },
});
