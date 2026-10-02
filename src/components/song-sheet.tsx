import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, StyleSheet, View } from 'react-native';

import { Sheet } from '@/components/fund-sheets';
import { Body, Button, Chip, ErrorText, Heading, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useUserId } from '@/lib/auth';
import { useActiveChurch } from '@/lib/church';
import { confirm } from '@/lib/confirm';
import type { SongLanguage, SongLibraryEntry } from '@/lib/database.types';
import { SONG_LANGUAGES, normalizeTags, useDeleteSong, useSaveSong, youtubeSearchUrl } from '@/lib/songs';
import { friendlyError } from '@/lib/supabase';
import { isWebLink } from '@/lib/worship';

/** Adds a song to the church's library, or with `existing` changes or deletes that one. */
export function SongSheet({ existing, onClose }: { existing: SongLibraryEntry | null; onClose: () => void }) {
  const { t } = useTranslation();
  const { church_id } = useActiveChurch();
  const userId = useUserId()!;
  const save = useSaveSong(church_id, userId);
  const remove = useDeleteSong(church_id);

  const [title, setTitle] = useState(existing?.title ?? '');
  const [artist, setArtist] = useState(existing?.artist ?? '');
  const [link, setLink] = useState(existing?.link ?? '');
  const [language, setLanguage] = useState<SongLanguage>(existing?.language ?? 'other');
  const [tagsText, setTagsText] = useState(existing?.tags.join(', ') ?? '');
  const [error, setError] = useState<string | null>(null);

  const linkBad = link.trim() !== '' && !isWebLink(link.trim());
  const valid = title.trim() !== '' && !linkBad;
  const busy = save.isPending || remove.isPending;

  async function onSave() {
    setError(null);
    try {
      await save.mutateAsync({
        id: existing?.id ?? null,
        input: { title: title.trim(), artist: artist.trim(), link: link.trim(), language, tags: normalizeTags(tagsText) },
      });
      onClose();
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  function onDelete() {
    if (!existing) return;
    confirm(t('songs.deleteTitle'), t('songs.deleteMessage', { title: existing.title }), t('common.delete'), async () => {
      try {
        await remove.mutateAsync(existing.id);
        onClose();
      } catch (e) {
        setError(friendlyError(e));
      }
    });
  }

  return (
    <Sheet onClose={onClose}>
      <Heading>{existing ? t('songs.editTitle') : t('songs.addTitle')}</Heading>
      <TextField label={t('worship.songTitle')} value={title} onChangeText={setTitle} maxLength={120} autoFocus={!existing} />
      <TextField label={t('worship.songArtist')} value={artist} onChangeText={setArtist} maxLength={100} />
      <TextField
        label={t('worship.songLink')}
        value={link}
        onChangeText={setLink}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        maxLength={500}
        placeholder="https://www.youtube.com/watch?v=…"
        hint={linkBad ? t('worship.linkBad') : t('worship.linkHint')}
      />
      <View style={styles.chips}>
        <Chip label={t('songs.findOnYoutube')} onPress={() => title.trim() && Linking.openURL(youtubeSearchUrl(title, artist))} />
      </View>
      <Body muted>{t('songs.languageLabel')}</Body>
      <View style={styles.chips}>
        {SONG_LANGUAGES.map((l) => (
          <Chip key={l} label={t(`songs.language.${l}`)} selected={language === l} onPress={() => setLanguage(l)} />
        ))}
      </View>
      <TextField
        label={t('songs.tagsLabel')}
        value={tagsText}
        onChangeText={setTagsText}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder={t('songs.tagsPlaceholder')}
        hint={t('songs.tagsHint')}
      />
      <ErrorText>{error}</ErrorText>
      <Button title={existing ? t('notes.saveChanges') : t('songs.addButton')} onPress={onSave} loading={save.isPending} disabled={!valid || busy} />
      {existing ? <Button title={t('common.delete')} variant="danger" onPress={onDelete} loading={remove.isPending} disabled={busy} /> : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
