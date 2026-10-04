import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { useActiveChurch, useChurch } from '@/lib/church';
import { publicUrl } from '@/lib/supabase';

/** The serif used for the church's name at the top of Home, loaded in the root layout. */
export const CHURCH_NAME_FONT = 'PlayfairDisplay_700Bold';

/**
 * The church's logo with its name in a serif beside it and the town in small capitals underneath, like the top of a
 * printed bulletin. Tapping it switches church when the person belongs to more than one.
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
      {logo ? (
        <Image source={{ uri: logo }} style={styles.logo} contentFit="cover" accessibilityIgnoresInvertColors />
      ) : (
        <View style={[styles.logo, styles.initials, { backgroundColor: theme.text }]}>
          <Text style={[styles.initialsText, { color: theme.page }]}>{initials}</Text>
        </View>
      )}
      <View style={styles.text}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, { color: theme.text }]} numberOfLines={2}>
            {church.name}
          </Text>
          {canSwitch ? <Ionicons name="chevron-down" size={20} color={theme.textSecondary} /> : null}
        </View>
        {church.city ? (
          <Text style={[styles.city, { color: theme.textSecondary }]} numberOfLines={1}>
            {church.city.toUpperCase()}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  logo: { width: 48, height: 48, borderRadius: 24 },
  initials: { alignItems: 'center', justifyContent: 'center' },
  initialsText: { fontFamily: CHURCH_NAME_FONT, fontSize: 18 },
  text: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { flexShrink: 1, fontFamily: CHURCH_NAME_FONT, fontSize: 30, lineHeight: 36 },
  city: { fontSize: 12, fontWeight: 700, letterSpacing: 2.2 },
});
