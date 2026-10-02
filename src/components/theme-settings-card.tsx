import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Body, Card, Chip, Heading } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useThemePreference, type ThemePreference } from '@/lib/theme-preference';

const MODES: ThemePreference[] = ['system', 'light', 'dark'];

/** Light, dark or the phone's own setting. Saved on this device. The colour comes from the church. */
export function ThemeSettingsCard() {
  const { t } = useTranslation();
  const { preference, setPreference } = useThemePreference();

  return (
    <Card>
      <Heading>{t('themeSettings.title')}</Heading>
      <View style={styles.chips}>
        {MODES.map((mode) => (
          <Chip key={mode} label={t(`themeSettings.${mode}`)} selected={preference === mode} onPress={() => setPreference(mode)} />
        ))}
      </View>
      <Body muted>{t('themeSettings.systemHint')}</Body>
    </Card>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
