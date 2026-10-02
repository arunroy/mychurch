import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { songUsage } from '@/components/song-picker';
import { SongSheet } from '@/components/song-sheet';
import { Body, Button, Card, Chip, ErrorText, Heading, Loading, Row, Screen, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useActiveChurch, usePermissions } from '@/lib/church';
import type { SongLanguage, SongLibraryEntry } from '@/lib/database.types';
import { SONG_LANGUAGES, useSongLibrary } from '@/lib/songs';
import { friendlyError } from '@/lib/supabase';

// The songs the church has used, kept so planners can pick them again. Only the people who can plan worship see this.
export default function SongsScreen() {
  const { t } = useTranslation();
  const { church_id } = useActiveChurch();
  const { canPlanWorship } = usePermissions();
  const library = useSongLibrary(church_id, canPlanWorship);
  const [query, setQuery] = useState('');
  const [language, setLanguage] = useState<SongLanguage | null>(null);
  const [tag, setTag] = useState<string | null>(null);
  const [editing, setEditing] = useState<SongLibraryEntry | 'new' | null>(null);

  if (!canPlanWorship) {
    return (
      <Screen edges={['bottom']}>
        <Body muted>{t('worship.onlyPlanners')}</Body>
      </Screen>
    );
  }
  if (library.isPending) return <Loading />;

  const songs = library.data ?? [];
  const languagesInUse = SONG_LANGUAGES.filter((l) => songs.some((s) => s.language === l));
  const tagsInUse = [...new Set(songs.flatMap((s) => s.tags))].sort();
  const q = query.trim().toLowerCase();
  const matches = songs
    .filter((s) => !language || s.language === language)
    .filter((s) => !tag || s.tags.includes(tag))
    .filter((s) => !q || s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q));

  return (
    <Screen edges={['bottom']}>
      <ErrorText>{library.error ? friendlyError(library.error) : null}</ErrorText>
      <Button title={t('songs.add')} onPress={() => setEditing('new')} />
      <Body muted>{t('songs.intro')}</Body>

      {songs.length > 0 ? (
        <>
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
        </>
      ) : (
        <Card>
          <Heading>{t('songs.emptyTitle')}</Heading>
          <Body muted>{t('songs.empty')}</Body>
        </Card>
      )}

      {songs.length > 0 && matches.length === 0 ? <Body muted>{t('songs.noMatch')}</Body> : null}
      {matches.length > 0 ? (
        <Card>
          {matches.map((song) => (
            <Row
              key={song.id}
              title={song.title}
              subtitle={[song.artist, t(`songs.language.${song.language}`), song.tags.map((x) => `#${x}`).join(' '), songUsage(song, t)]
                .filter(Boolean)
                .join(' · ')}
              onPress={() => setEditing(song)}
            />
          ))}
        </Card>
      ) : null}

      {editing ? <SongSheet key={editing === 'new' ? 'new' : editing.id} existing={editing === 'new' ? null : editing} onClose={() => setEditing(null)} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
