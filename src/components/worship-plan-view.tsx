import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { Body, Button, Chip, useAccentText } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { isWebLink, type WorshipPlanWithSongs } from '@/lib/worship';

/** The Psalm (tap to read it in the Bible) and the numbered songs, each with a link to listen when there is one. */
export function WorshipPlanView({ plan }: { plan: WorshipPlanWithSongs }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const accentText = useAccentText();

  return (
    <View style={styles.box}>
      {plan.psalm_chapter ? (
        <View style={styles.psalm}>
          <Body muted>{t('worship.psalm')}</Body>
          <Text style={[styles.reference, { color: theme.text }]}>{plan.psalm_reference}</Text>
          <Button
            title={t('worship.readPsalm')}
            variant="secondary"
            onPress={() => router.push({ pathname: '/bible', params: { book: 'Psalms', chapter: String(plan.psalm_chapter) } })}
          />
        </View>
      ) : null}

      {plan.songs.length > 0 ? (
        <View style={styles.songs}>
          <Body muted>{t('worship.songs')}</Body>
          {plan.songs.map((song, index) => (
            <View key={song.id} style={styles.song}>
              <Text style={[styles.number, { color: accentText }]}>{index + 1}</Text>
              <View style={styles.songText}>
                <Text style={[styles.title, { color: theme.text }]}>{song.title}</Text>
                {song.artist ? <Text style={{ color: theme.textSecondary }}>{song.artist}</Text> : null}
              </View>
              {isWebLink(song.link) ? <Chip label={t('worship.listen')} onPress={() => Linking.openURL(song.link)} /> : null}
            </View>
          ))}
        </View>
      ) : null}

      {!plan.psalm_chapter && plan.songs.length === 0 ? <Body muted>{t('worship.nothingYet')}</Body> : null}
      {plan.note ? <Body>{plan.note}</Body> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: Spacing.three },
  psalm: { gap: Spacing.one },
  reference: { fontSize: 20, fontWeight: 700 },
  songs: { gap: Spacing.two },
  song: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  number: { fontSize: 18, fontWeight: 700, width: 24 },
  songText: { flex: 1 },
  title: { fontSize: 17, fontWeight: 600 },
});
