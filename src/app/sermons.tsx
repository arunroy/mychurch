import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { SourceTag } from '@/components/sermon-tag';
import { Body, Button, Card, Chip, ErrorText, Gap, Heading, Loading, Row, Screen, TextField } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useActiveChurch, usePermissions } from '@/lib/church';
import { formatDay } from '@/lib/dates';
import type { SermonItem, SermonSource } from '@/lib/database.types';
import { matchesSearch, SOURCES, useSermons } from '@/lib/sermons';
import { friendlyError } from '@/lib/supabase';

// The church's sermons. The Pastor's own come first; members' articles and outside sermons sit under their own
// filters. Search looks at all of them, and every sermon carries a tag saying where it comes from. Articles and
// outside links only appear here once the Pastor has approved them.
export default function SermonsScreen() {
  const { church_id } = useActiveChurch();
  const { isPastor } = usePermissions();
  const sermons = useSermons(church_id);
  const [filter, setFilter] = useState<SermonSource>('pastor');
  const [search, setSearch] = useState('');

  const all = sermons.data ?? [];
  const searching = search.trim() !== '';
  // Entries still waiting for review, or turned down, are shown in their own sections, not in the lists.
  const approved = all.filter((s) => s.status === 'approved');
  const shown = searching ? approved.filter((s) => matchesSearch(s, search)) : approved.filter((s) => s.source === filter);
  const waitingForReview = isPastor ? all.filter((s) => s.status === 'pending') : [];
  const mine = isPastor ? [] : all.filter((s) => s.is_mine && s.status !== 'approved');

  return (
    <Screen edges={['bottom']}>
      <View style={styles.buttons}>
        {isPastor ? (
          <>
            <Button title="Add a sermon" onPress={() => router.push('/sermon-edit')} style={styles.button} />
            <Button title="Add an outside sermon" variant="secondary" onPress={() => router.push('/sermon-suggest')} style={styles.button} />
          </>
        ) : (
          <>
            <Button title="Write an article" onPress={() => router.push('/sermon-write')} style={styles.button} />
            <Button title="Share an outside sermon" variant="secondary" onPress={() => router.push('/sermon-suggest')} style={styles.button} />
          </>
        )}
      </View>

      <ErrorText>{sermons.error ? friendlyError(sermons.error) : null}</ErrorText>
      {sermons.isPending ? <Loading /> : null}

      {waitingForReview.length > 0 ? (
        <>
          <Heading>{`Waiting for your review (${waitingForReview.length})`}</Heading>
          <List items={waitingForReview} showStatus />
        </>
      ) : null}

      {mine.length > 0 ? (
        <>
          <Heading>Your submissions</Heading>
          <List items={mine} showStatus />
        </>
      ) : null}

      <TextField label="Search all sermons" value={search} onChangeText={setSearch} placeholder="Title, speaker, author or passage" autoCorrect={false} />

      {searching ? null : (
        <View style={styles.chips}>
          {SOURCES.map((source) => (
            <Chip key={source.value} label={source.filter} selected={filter === source.value} onPress={() => setFilter(source.value)} />
          ))}
        </View>
      )}
      {searching ? <Body muted>{`Searching every sermon: ${shown.length} found.`}</Body> : null}

      {!sermons.isPending && shown.length === 0 ? (
        <Body muted>{searching ? 'No sermon matches that.' : emptyText(filter)}</Body>
      ) : null}
      {shown.length > 0 ? <List items={shown} /> : null}
      <Gap />
    </Screen>
  );
}

function emptyText(filter: SermonSource) {
  if (filter === 'pastor') return 'No sermons from the Pastor yet.';
  if (filter === 'member') return 'No articles from members yet. Write one, and once the Pastor approves it, it appears here.';
  return 'No outside sermons yet. Share one you found, and once the Pastor approves it, it appears here.';
}

function statusText(item: SermonItem) {
  if (item.status === 'pending') return 'Waiting for review';
  if (item.status === 'declined') return 'Not approved';
  return item.published ? null : 'Draft';
}

function List({ items, showStatus }: { items: SermonItem[]; showStatus?: boolean }) {
  return (
    <Card>
      {items.map((sermon) => (
        <Row
          key={sermon.id}
          title={sermon.title}
          subtitle={[
            showStatus || sermon.status !== 'approved' ? statusText(sermon) : sermon.published ? null : 'Draft',
            sermon.author_name ? (sermon.source === 'external' ? `Shared by ${sermon.author_name}` : sermon.author_name) : null,
            sermon.speaker || null,
            formatDay(sermon.sermon_date),
            sermon.reference || null,
          ]
            .filter(Boolean)
            .join(' · ')}
          right={<SourceTag source={sermon.source} />}
          onPress={() => router.push({ pathname: '/sermon/[id]', params: { id: sermon.id } })}
        />
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  button: { flexGrow: 1, flexBasis: '45%' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
