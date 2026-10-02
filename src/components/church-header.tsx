import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useActiveChurch, useChurch } from '@/lib/church';
import { publicUrl } from '@/lib/supabase';

/** The church's logo and name. Tapping it switches church when the person belongs to more than one. */
export function ChurchHeader() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { church } = useActiveChurch();
  const { memberships } = useChurch();
  const canSwitch = memberships.length > 1;

  return (
    <Pressable
      disabled={!canSwitch}
      onPress={() => router.push('/switch-church')}
      accessibilityRole={canSwitch ? 'button' : 'header'}
      accessibilityHint={canSwitch ? t('churchHeader.hint') : undefined}
      style={styles.row}>
      <Avatar name={church.name} uri={publicUrl('church-logos', church.logo_path)} color={church.accent_color} size={48} />
      <View style={styles.text}>
        <Text style={[styles.name, { color: theme.text }]} numberOfLines={2}>
          {church.name}
        </Text>
        {church.city ? <Text style={{ color: theme.textSecondary }}>{church.city}</Text> : null}
      </View>
      {canSwitch ? <Text style={{ color: theme.textSecondary }}>{t('churchHeader.switch')}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  text: { flex: 1 },
  name: { fontSize: 22, fontWeight: 700 },
});
