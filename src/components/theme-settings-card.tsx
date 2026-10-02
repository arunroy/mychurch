import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Body, Heading, Segmented } from '@/components/ui';
import { useThemePreference, type ThemePreference } from '@/lib/theme-preference';

const MODES: ThemePreference[] = ['system', 'light', 'dark'];

/** Light, dark or the phone's own setting. Saved on this device. */
export function ThemeSettingsCard() {
  const { t } = useTranslation();
  const { preference, setPreference } = useThemePreference();

  return (
    <View style={{ gap: 8 }}>
      <Heading>{t('themeSettings.title')}</Heading>
      <Segmented value={preference} onChange={setPreference} options={MODES.map((mode) => ({ value: mode, label: t(`themeSettings.${mode}`) }))} />
      <Body muted>{t('themeSettings.systemHint')}</Body>
    </View>
  );
}
