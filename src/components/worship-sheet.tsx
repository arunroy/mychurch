import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, StyleSheet, View } from 'react-native';

import { DateField } from '@/components/date-time-fields';
import { Sheet } from '@/components/fund-sheets';
import { SongPicker } from '@/components/song-picker';
import { Body, Button, Card, Chip, ErrorText, Heading, TextField } from '@/components/ui';
import { VersePicker, type PassageDraft } from '@/components/verse-picker';
import { Spacing } from '@/constants/theme';
import { useActiveChurch } from '@/lib/church';
import { formatDay, isValidDateKey, parseDateKey, thisSunday } from '@/lib/dates';
import type { SongLanguage, SongLibraryEntry } from '@/lib/database.types';
import { SONG_LANGUAGES, normalizeTags, useSongLibrary, youtubeSearchUrl } from '@/lib/songs';
import { friendlyError } from '@/lib/supabase';
import { isWebLink, useSaveWorshipPlan, type WorshipPlanWithSongs } from '@/lib/worship';

const MAX_SONGS = 12;

type SongDraft = {
  key: number;
  /** The library song this came from, so it is not picked twice. */
  songId: string | null;
  title: string;
  artist: string;
  link: string;
  language: SongLanguage;
  tagsText: string;
};

/** Plans a Sunday, or with `existing` changes that plan: the Psalm, up to 12 songs in order, and a note. */
export function WorshipSheet({
  existing,
  plans,
  onClose,
}: {
  existing: WorshipPlanWithSongs | null;
  /** The plans already made, to warn when a date already has one. */
  plans: WorshipPlanWithSongs[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { church_id } = useActiveChurch();
  const save = useSaveWorshipPlan(church_id);
  // The library gives each song's language and tags back when a plan is edited.
  const library = useSongLibrary(church_id, true);

  const [date, setDate] = useState(existing?.service_date ?? thisSunday());
  const [psalm, setPsalm] = useState<PassageDraft | null>(
    existing?.psalm_chapter
      ? {
          translation: 'web',
          book: 'Psalms',
          chapter: existing.psalm_chapter,
          verseStart: existing.psalm_verse_start ?? 1,
          verseEnd: existing.psalm_verse_end ?? existing.psalm_verse_start ?? 1,
        }
      : null,
  );
  const [songs, setSongs] = useState<SongDraft[]>(() =>
    (existing?.songs ?? []).map((s, i) => ({
      key: i,
      songId: s.song_id,
      title: s.title,
      artist: s.artist,
      link: s.link,
      language: 'other',
      tagsText: '',
    })),
  );
  const [nextKey, setNextKey] = useState(existing?.songs.length ?? 0);
  const [note, setNote] = useState(existing?.note ?? '');
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A song that came from the library shows the language and tags the library has, unless the planner changed them here.
  const [touched, setTouched] = useState<Set<number>>(new Set());
  const shown = (song: SongDraft) => {
    const entry = song.songId ? library.data?.find((s) => s.id === song.songId) : undefined;
    return {
      language: touched.has(song.key) || !entry ? song.language : entry.language,
      tagsText: touched.has(song.key) || !entry ? song.tagsText : entry.tags.join(', '),
    };
  };

  const validDate = isValidDateKey(date) && parseDateKey(date).getDay() === 0;
  const replaces = !existing && plans.some((p) => p.service_date === date);
  const songsOk = songs.every((s) => s.title.trim() !== '' && (s.link.trim() === '' || isWebLink(s.link.trim())));
  const valid = validDate && songsOk;

  function update(key: number, patch: Partial<SongDraft>) {
    // Once a planner changes a song's language or tags, theirs win over the library's.
    if (patch.language !== undefined || patch.tagsText !== undefined) {
      setTouched((set) => new Set(set).add(key));
      setSongs((list) =>
        list.map((s) => {
          if (s.key !== key) return s;
          const current = shown(s);
          return { ...s, ...current, ...patch };
        }),
      );
      return;
    }
    setSongs((list) => list.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  }

  function move(index: number, by: -1 | 1) {
    setSongs((list) => {
      const next = [...list];
      const target = index + by;
      if (target < 0 || target >= next.length) return list;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function addFromLibrary(song: SongLibraryEntry) {
    setSongs((list) => [
      ...list,
      { key: nextKey, songId: song.id, title: song.title, artist: song.artist, link: song.link, language: song.language, tagsText: song.tags.join(', ') },
    ]);
    setTouched((set) => new Set(set).add(nextKey));
    setNextKey(nextKey + 1);
    setPicking(false);
  }

  async function onSave() {
    setError(null);
    try {
      await save.mutateAsync({
        date,
        psalm: psalm?.book ? { chapter: psalm.chapter, verseStart: psalm.verseStart, verseEnd: psalm.verseEnd } : null,
        note: note.trim(),
        songs: songs.map((s) => {
          const current = shown(s);
          return {
            title: s.title.trim(),
            artist: s.artist.trim(),
            link: s.link.trim(),
            language: current.language,
            tags: normalizeTags(current.tagsText),
          };
        }),
      });
      onClose();
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  return (
    <Sheet onClose={onClose}>
      <Heading>{existing ? t('worship.editTitle') : t('worship.planTitle')}</Heading>
      <DateField
        label={t('worship.sunday')}
        value={date}
        onChange={setDate}
        hint={!isValidDateKey(date) ? t('sermonEdit.chooseDate') : !validDate ? t('worship.notSunday') : formatDay(date)}
      />
      {replaces ? <Body muted>{t('worship.replaces')}</Body> : null}

      <Heading>{t('worship.psalm')}</Heading>
      {psalm ? (
        <>
          <VersePicker value={psalm} onChange={setPsalm} showTranslation={false} lockedBook />
          <Button title={t('worship.noPsalm')} variant="secondary" onPress={() => setPsalm(null)} />
        </>
      ) : (
        <Button
          title={t('worship.choosePsalm')}
          variant="secondary"
          onPress={() => setPsalm({ translation: 'web', book: 'Psalms', chapter: 23, verseStart: 1, verseEnd: 1 })}
        />
      )}

      <Heading>{t('worship.songs')}</Heading>
      {songs.map((song, index) => {
        const current = shown(song);
        return (
          <Card key={song.key}>
            <Body muted>{t('worship.songNumber', { number: index + 1 })}</Body>
            <TextField label={t('worship.songTitle')} value={song.title} onChangeText={(v) => update(song.key, { title: v })} maxLength={120} />
            <TextField label={t('worship.songArtist')} value={song.artist} onChangeText={(v) => update(song.key, { artist: v })} maxLength={100} />
            <TextField
              label={t('worship.songLink')}
              value={song.link}
              onChangeText={(v) => update(song.key, { link: v })}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              maxLength={500}
              placeholder="https://www.youtube.com/watch?v=…"
              hint={song.link.trim() && !isWebLink(song.link.trim()) ? t('worship.linkBad') : t('worship.linkHint')}
            />
            <View style={styles.chips}>
              <Chip
                label={t('songs.findOnYoutube')}
                onPress={() => song.title.trim() && Linking.openURL(youtubeSearchUrl(song.title, song.artist))}
              />
            </View>
            <Body muted>{t('songs.languageLabel')}</Body>
            <View style={styles.chips}>
              {SONG_LANGUAGES.map((l) => (
                <Chip key={l} label={t(`songs.language.${l}`)} selected={current.language === l} onPress={() => update(song.key, { language: l })} />
              ))}
            </View>
            <TextField
              label={t('songs.tagsLabel')}
              value={current.tagsText}
              onChangeText={(v) => update(song.key, { tagsText: v })}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder={t('songs.tagsPlaceholder')}
              hint={t('songs.tagsHint')}
            />
            <View style={styles.chips}>
              <Chip label={t('worship.moveUp')} onPress={() => move(index, -1)} />
              <Chip label={t('worship.moveDown')} onPress={() => move(index, 1)} />
              <Chip label={t('common.remove')} onPress={() => setSongs((list) => list.filter((s) => s.key !== song.key))} />
            </View>
          </Card>
        );
      })}

      {picking ? (
        <SongPicker taken={new Set(songs.flatMap((s) => (s.songId ? [s.songId] : [])))} onPick={addFromLibrary} onClose={() => setPicking(false)} />
      ) : null}

      {songs.length < MAX_SONGS ? (
        <View style={styles.chips}>
          <Button
            title={t('worship.addSong')}
            variant="secondary"
            style={styles.half}
            onPress={() => {
              setSongs((list) => [...list, { key: nextKey, songId: null, title: '', artist: '', link: '', language: 'other', tagsText: '' }]);
              setNextKey(nextKey + 1);
            }}
          />
          <Button title={t('songs.addFromLibrary')} variant="secondary" style={styles.half} onPress={() => setPicking(true)} />
        </View>
      ) : (
        <Body muted>{t('worship.maxSongs', { count: MAX_SONGS })}</Body>
      )}

      <TextField
        label={t('worship.note')}
        value={note}
        onChangeText={setNote}
        multiline
        maxLength={300}
        style={{ minHeight: 70, paddingTop: 12, textAlignVertical: 'top' }}
      />
      <ErrorText>{error}</ErrorText>
      <Button title={t('worship.save')} onPress={onSave} loading={save.isPending} disabled={!valid} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  half: { flex: 1 },
});
