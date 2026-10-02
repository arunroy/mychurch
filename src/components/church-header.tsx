import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ACCENT } from '@/constants/theme';
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
      {logo ? (
        <Image source={{ uri: logo }} style={styles.logo} contentFit="cover" accessibilityIgnoresInvertColors />
      ) : (
        <View style={[styles.logo, styles.initials, { backgroundColor: ACCENT }]}>
          <Text style={styles.initialsText}>{initials}</Text>
        </View>
      )}
      <View style={styles.text}>
        <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
          {church.name}
        </Text>
        {church.city ? (
          <Text style={[styles.city, { color: theme.textSecondary }]} numberOfLines={1}>
            {church.city}
          </Text>
        ) : null}
      </View>
      {canSwitch ? <Ionicons name="chevron-down" size={20} color={theme.textSecondary} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  logo: { width: 44, height: 44, borderRadius: 14 },
  initials: { alignItems: 'center', justifyContent: 'center' },
  initialsText: { color: '#FFFFFF', fontSize: 16, fontWeight: 700 },
  text: { flex: 1, gap: 1 },
  name: { fontSize: 16, fontWeight: 700 },
  city: { fontSize: 13 },
});
