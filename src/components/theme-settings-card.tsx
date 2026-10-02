import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Body, Card, Chip, Heading, useAccentText } from '@/components/ui';
import { Colors, DEFAULT_ACCENT, Spacing, THEMES } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useChurch } from '@/lib/church';
import { useThemePreference, type ThemePreference } from '@/lib/theme-preference';

const MODES: ThemePreference[] = ['system', 'light', 'dark'];

/**
 * Light, dark or system, and a theme. A theme is a matched set of background, text and accent
 * colours, so every choice looks designed. Saved on this device.
 */
export function ThemeSettingsCard() {
  const { t } = useTranslation();
  const { preference, setPreference, scheme, themeId, setThemeId } = useThemePreference();
  const churchColour = useChurch().active?.church.accent_color ?? DEFAULT_ACCENT;
  const plain = Colors[scheme];

  return (
    <Card>
      <Heading>{t('themeSettings.title')}</Heading>

      <Body>{t('themeSettings.mode')}</Body>
      <View style={styles.chips}>
        {MODES.map((mode) => (
          <Chip key={mode} label={t(`themeSettings.${mode}`)} selected={preference === mode} onPress={() => setPreference(mode)} />
        ))}
      </View>
      <Body muted>{t('themeSettings.systemHint')}</Body>

      <Body>{t('themeSettings.theme')}</Body>
      <View style={styles.swatches}>
        <Swatch name={t('themeSettings.plain')} selected={themeId === null} onPress={() => setThemeId(null)}>
          <View style={[styles.preview, { backgroundColor: plain.background }]}>
            <Text style={[styles.aa, { color: plain.text }]}>Aa</Text>
            <View style={[styles.dot, { backgroundColor: churchColour }]} />
          </View>
        </Swatch>
        {THEMES.map((theme) => {
          const palette = theme[scheme];
          return (
            <Swatch key={theme.id} name={theme.name} selected={themeId === theme.id} onPress={() => setThemeId(theme.id)}>
              <LinearGradient colors={[...palette.gradient]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.preview}>
                <Text style={[styles.aa, { color: palette.text }]}>Aa</Text>
                <View style={[styles.dot, { backgroundColor: palette.accent }]} />
              </LinearGradient>
            </Swatch>
          );
        })}
      </View>
      <Body muted>{t('themeSettings.plainHint')}</Body>
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
  const { t } = useTranslation();
  const theme = useTheme();
  const accentText = useAccentText();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('themeSettings.swatch', { name })}
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
