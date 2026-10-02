import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Card, Chip, ErrorText, Loading, Row, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useActiveChurch } from '@/lib/church';
import type { SongLanguage, SongLibraryEntry } from '@/lib/database.types';
import { SONG_LANGUAGES, useSongLibrary, weeksAgo } from '@/lib/songs';
import { friendlyError } from '@/lib/supabase';

const MAX_SHOWN = 12;

/** "Last sung 3 weeks ago · 12 times", or "Not sung yet". */
export function songUsage(song: SongLibraryEntry, t: (key: string, options?: Record<string, unknown>) => string) {
  const parts: string[] = [];
  if (song.last_sung) {
    const weeks = weeksAgo(song.last_sung);
    parts.push(weeks === 0 ? t('songs.lastSungThisWeek') : t('songs.lastSung', { count: weeks }));
    parts.push(t('songs.timesSung', { count: song.times_sung }));
  } else {
    parts.push(t('songs.notSungYet'));
  }
  if (song.next_planned) parts.push(t('songs.plannedNext'));
  return parts.join(' · ');
}

/**
 * Pick a song the church has used before, from the church's own library. Search by title or artist, and narrow by
 * language or tag. Shows when each was last sung, so a song is not repeated too soon.
 */
export function SongPicker({ taken, onPick, onClose }: { taken: Set<string>; onPick: (song: SongLibraryEntry) => void; onClose: () => void }) {
  const { t } = useTranslation();
  const { church_id } = useActiveChurch();
  const library = useSongLibrary(church_id, true);
  const [query, setQuery] = useState('');
  const [language, setLanguage] = useState<SongLanguage | null>(null);
  const [tag, setTag] = useState<string | null>(null);

  const songs = library.data ?? [];
  const languagesInUse = SONG_LANGUAGES.filter((l) => songs.some((s) => s.language === l));
  const tagsInUse = [...new Set(songs.flatMap((s) => s.tags))].sort();
  const q = query.trim().toLowerCase();
  const matches = songs
    .filter((s) => !language || s.language === language)
    .filter((s) => !tag || s.tags.includes(tag))
    .filter((s) => !q || s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q));

  return (
    <Card>
      <TextField label={t('songs.search')} value={query} onChangeText={setQuery} autoCorrect={false} placeholder={t('songs.searchPlaceholder')} />
      {languagesInUse.length > 1 ? (
        <View style={styles.chips}>
          {languagesInUse.map((l) => (
            <Chip key={l} label={t(`songs.language.${l}`)} selected={language === l} onPress={() => setLanguage(language === l ? null : l)} />
          ))}
        </View>
      ) : null}
      {tagsInUse.length > 0 ? (
        <View style={styles.chips}>
          {tagsInUse.map((x) => (
            <Chip key={x} label={`#${x}`} selected={tag === x} onPress={() => setTag(tag === x ? null : x)} />
          ))}
        </View>
      ) : null}

      {library.isPending ? <Loading /> : null}
      <ErrorText>{library.error ? friendlyError(library.error) : null}</ErrorText>
      {library.data && songs.length === 0 ? <Body muted>{t('songs.emptyPicker')}</Body> : null}
      {library.data && songs.length > 0 && matches.length === 0 ? <Body muted>{t('songs.noMatch')}</Body> : null}

      {matches.slice(0, MAX_SHOWN).map((song) => (
        <Row
          key={song.id}
          title={song.title}
          subtitle={[song.artist, t(`songs.language.${song.language}`), songUsage(song, t)].filter(Boolean).join(' · ')}
          right={taken.has(song.id) ? <Body muted>{t('songs.alreadyAdded')}</Body> : undefined}
          onPress={taken.has(song.id) ? undefined : () => onPick(song)}
        />
      ))}
      {matches.length > MAX_SHOWN ? <Body muted>{t('songs.narrow', { count: matches.length - MAX_SHOWN })}</Body> : null}
      <Button title={t('common.close')} variant="secondary" onPress={onClose} />
    </Card>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
