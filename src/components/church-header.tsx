import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ACCENT } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useActiveChurch, useChurch } from '@/lib/church';
import { publicUrl } from '@/lib/supabase';

/**
 * The church's name as the screen's large title, with its logo beside it. Tapping it switches church when the person
 * belongs to more than one.
 */
export function ChurchHeader() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { church } = useActiveChurch();
  const { memberships } = useChurch();
  const canSwitch = memberships.length > 1;
  const logo = publicUrl('church-logos', church.logo_path);
  const initials =
    church.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || '?';

  return (
    <Pressable
      disabled={!canSwitch}
      onPress={() => router.push('/switch-church')}
      accessibilityRole={canSwitch ? 'button' : 'header'}
      accessibilityHint={canSwitch ? t('churchHeader.hint') : undefined}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}>
      <View style={styles.titleRow}>
        <Text style={[styles.name, { color: theme.text }]} numberOfLines={2}>
          {church.name}
        </Text>
        {canSwitch ? <Ionicons name="chevron-down" size={22} color={theme.textSecondary} /> : null}
      </View>
      {logo ? (
        <Image source={{ uri: logo }} style={styles.logo} contentFit="cover" accessibilityIgnoresInvertColors />
      ) : (
        <View style={[styles.logo, styles.initials, { backgroundColor: ACCENT }]}>
          <Text style={styles.initialsText}>{initials}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  titleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { flexShrink: 1, fontSize: 34, lineHeight: 41, fontWeight: 700, letterSpacing: -0.4 },
  logo: { width: 40, height: 40, borderRadius: 20 },
  initials: { alignItems: 'center', justifyContent: 'center' },
  initialsText: { color: '#FFFFFF', fontSize: 15, fontWeight: 700 },
});
