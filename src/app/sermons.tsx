import * as WebBrowser from 'expo-web-browser';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { StyleSheet, View } from 'react-native';

import { SourceTag } from '@/components/sermon-tag';
import { Body, Button, Card, ErrorText, Gap, Heading, Loading, Row, Screen, TextField, Segmented } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useActiveChurch, usePermissions } from '@/lib/church';
import { formatDay } from '@/lib/dates';
import type { SermonItem, SermonSource } from '@/lib/database.types';
import { directLink, matchesSearch, SOURCES, useSermons } from '@/lib/sermons';
import { friendlyError } from '@/lib/supabase';

// The church's sermons. The Pastor's own come first; members' articles and outside sermons sit under their own
// filters. Search looks at all of them, and every sermon carries a tag saying where it comes from. Articles and
// outside links only appear here once the Pastor has approved them.
export default function SermonsScreen() {
  const { t } = useTranslation();
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
            <Button title={t('sermons.addSermon')} onPress={() => router.push('/sermon-edit')} style={styles.button} />
            <Button title={t('sermons.addOutside')} variant="secondary" onPress={() => router.push('/sermon-suggest')} style={styles.button} />
          </>
        ) : (
          <>
            <Button title={t('sermons.writeArticle')} onPress={() => router.push('/sermon-write')} style={styles.button} />
            <Button title={t('sermons.shareOutside')} variant="secondary" onPress={() => router.push('/sermon-suggest')} style={styles.button} />
          </>
        )}
      </View>

      <ErrorText>{sermons.error ? friendlyError(sermons.error) : null}</ErrorText>
      {sermons.isPending ? <Loading /> : null}

      {waitingForReview.length > 0 ? (
        <>
          <Heading>{t('sermons.waitingReview', { count: waitingForReview.length })}</Heading>
          <List items={waitingForReview} showStatus />
        </>
      ) : null}

      {mine.length > 0 ? (
        <>
          <Heading>{t('sermons.yourSubmissions')}</Heading>
          <List items={mine} showStatus />
        </>
      ) : null}

      <TextField label={t('sermons.searchLabel')} value={search} onChangeText={setSearch} placeholder={t('sermons.searchPlaceholder')} autoCorrect={false} />

      {searching ? null : (
        <Segmented
          value={filter}
          onChange={setFilter}
          options={SOURCES.map((source) => ({ value: source.value, label: t(`sermons.filter${source.value[0].toUpperCase()}${source.value.slice(1)}`) }))}
        />
      )}
      {searching ? <Body muted>{t('sermons.searching', { count: shown.length })}</Body> : null}

      {!sermons.isPending && shown.length === 0 ? (
        <Body muted>{searching ? t('sermons.noMatch') : emptyText(filter, t)}</Body>
      ) : null}
      {shown.length > 0 ? <List items={shown} /> : null}
      <Gap />
    </Screen>
  );
}

function emptyText(filter: SermonSource, t: TFunction) {
  if (filter === 'pastor') return t('sermons.emptyPastor');
  if (filter === 'member') return t('sermons.emptyMember');
  return t('sermons.emptyExternal');
}

function statusText(item: SermonItem, t: TFunction) {
  if (item.status === 'pending') return t('sermons.statusPending');
  if (item.status === 'declined') return t('sermons.statusDeclined');
  return item.published ? null : t('sermons.statusDraft');
}

function List({ items, showStatus }: { items: SermonItem[]; showStatus?: boolean }) {
  const { t } = useTranslation();
  const { isPastor } = usePermissions();
  const [error, setError] = useState<string | null>(null);

  const details = (sermon: SermonItem) => router.push({ pathname: '/sermon/[id]', params: { id: sermon.id } });

  async function open(sermon: SermonItem) {
    const link = directLink(sermon);
    if (!link) {
      details(sermon);
      return;
    }
    setError(null);
    try {
      await WebBrowser.openBrowserAsync(link);
    } catch {
      setError(t('sermon.linkFail'));
    }
  }

  const canManage = isPastor || items.some((s) => s.is_mine);

  return (
    <>
      <ErrorText>{error}</ErrorText>
      <Card>
        {items.map((sermon) => (
          <Row
            key={sermon.id}
            title={sermon.title}
            subtitle={[
              showStatus || sermon.status !== 'approved' ? statusText(sermon, t) : sermon.published ? null : t('sermons.statusDraft'),
              sermon.author_name ? (sermon.source === 'external' ? t('sermons.sharedBy', { name: sermon.author_name }) : sermon.author_name) : null,
              sermon.speaker || null,
              formatDay(sermon.sermon_date),
              sermon.reference || null,
            ]
              .filter(Boolean)
              .join(' · ')}
            right={<SourceTag source={sermon.source} link={sermon.read_url || sermon.media_url} />}
            onPress={() => open(sermon)}
            onLongPress={isPastor || sermon.is_mine ? () => details(sermon) : undefined}
          />
        ))}
      </Card>
      {canManage && items.some((s) => directLink(s)) ? <Body muted>{t('sermons.holdToManage')}</Body> : null}
    </>
  );
}

const styles = StyleSheet.create({
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  button: { flexGrow: 1, flexBasis: '45%' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
