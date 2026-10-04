import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CHURCH_NAME_FONT } from '@/components/church-header';
import { ACCENT, withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useActiveChurch, useChurch } from '@/lib/church';
import { publicUrl } from '@/lib/supabase';

/** How opaque the page colour is at each step of the fade, eased so the photo melts away rather than ending in a band. */
const FADE_ALPHAS = [0, 0.35, 0.8, 1] as const;
const FADE_LOCATIONS = [0.38, 0.56, 0.74, 0.92] as const;

/** How far the name is pulled up over the faded bottom of the photo. */
const OVERLAP = 40;

/** The shape to keep until the photo has loaded and told us its own: a wide church photo, 2000 × 881. */
const DEFAULT_RATIO = 2000 / 881;

/**
 * The church's photo across the top of Home, at the photo's own shape so none of it is cut off, fading into the page
 * at its lower edge, with the logo, the church's name in a serif and the town in small capitals over the fade.
 */
export function PhotoBanner() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { church } = useActiveChurch();
  const { memberships } = useChurch();
  const canSwitch = memberships.length > 1;
  const photo = publicUrl('church-logos', church.banner_path);
  const logo = publicUrl('church-logos', church.logo_path);
  const [ratio, setRatio] = useState(DEFAULT_RATIO);
  const initials =
    church.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || '?';
  const fade = FADE_ALPHAS.map((alpha) => withAlpha(theme.page, alpha)) as [string, string, ...string[]];

  return (
    <View>
      <View style={[styles.photo, { aspectRatio: ratio, backgroundColor: theme.backgroundSelected }]}>
        {photo ? (
          <Image
            source={{ uri: photo }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            accessibilityIgnoresInvertColors
            onLoad={(e) => {
              const { width, height } = e.source;
              // Very tall photos would push Home down too far, so never taller than 4:3.
              if (width > 0 && height > 0) setRatio(Math.max(width / height, 4 / 3));
            }}
          />
        ) : null}
        <LinearGradient colors={fade} locations={FADE_LOCATIONS} style={StyleSheet.absoluteFill} pointerEvents="none" />
      </View>
      <Pressable
        disabled={!canSwitch}
        onPress={() => router.push('/switch-church')}
        accessibilityRole={canSwitch ? 'button' : 'header'}
        accessibilityHint={canSwitch ? t('churchHeader.hint') : undefined}
        style={({ pressed }) => [styles.nameRow, { opacity: pressed ? 0.7 : 1 }]}>
        {logo ? (
          <Image
            source={{ uri: logo }}
            style={[styles.logo, { borderColor: theme.background }]}
            contentFit="cover"
            accessibilityIgnoresInvertColors
          />
        ) : (
          <View style={[styles.logo, styles.initials, { borderColor: theme.background }]}>
            <Text style={styles.initialsText}>{initials}</Text>
          </View>
        )}
        <View style={styles.text}>
          <Text style={[styles.name, { color: theme.text }]} numberOfLines={2}>
            {church.name}
          </Text>
          {church.city ? (
            <Text style={[styles.city, { color: theme.textSecondary }]} numberOfLines={1}>
              {church.city.toUpperCase()}
            </Text>
          ) : null}
        </View>
        {canSwitch ? <Ionicons name="chevron-down" size={20} color={theme.textSecondary} /> : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  photo: { width: '100%', overflow: 'hidden' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, marginTop: -OVERLAP },
  // A ring in the page's card colour and a soft shadow lift the logo off the photo behind it.
  logo: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 3,
    boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
  },
  initials: { backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  initialsText: { color: ACCENT, fontFamily: CHURCH_NAME_FONT, fontSize: 20 },
  text: { flex: 1, gap: 2 },
  name: { fontFamily: CHURCH_NAME_FONT, fontSize: 28, lineHeight: 34 },
  city: { fontSize: 12, fontWeight: 700, letterSpacing: 2.2 },
});
