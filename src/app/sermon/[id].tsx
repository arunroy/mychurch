import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { SourceTag } from '@/components/sermon-tag';
import { ReportButton } from '@/components/report-sheet';
import { Body, Button, Card, ErrorText, Heading, Loading, Screen, TextField, Title } from '@/components/ui';
import { useActiveChurch, usePermissions } from '@/lib/church';
import { confirm } from '@/lib/confirm';
import { formatDay } from '@/lib/dates';
import { linkSite, useDeleteSermon, useReviewSermon, useSermon } from '@/lib/sermons';
import { friendlyError } from '@/lib/supabase';

// One sermon. A member's article is shown in full; an outside sermon is a link; the Pastor's can be text, links or both.
// The Pastor reviews waiting entries here, approving them or declining with a note.
export default function SermonScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { church_id } = useActiveChurch();
  const { isPastor } = usePermissions();
  const sermon = useSermon(church_id, id);
  const remove = useDeleteSermon(church_id);
  const review = useReviewSermon(church_id);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (sermon.isPending) return <Loading />;

  if (!sermon.data) {
    return (
      <Screen edges={['bottom']}>
        <Body muted>{t('sermon.gone')}</Body>
        <Button title={t('sermon.backTo')} variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }

  const item = sermon.data;
  const official = item.source === 'pastor';
  const canEditOwn = item.is_mine && !official;

  async function open(url: string) {
    setError(null);
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch {
      setError(t('sermon.linkFail'));
    }
  }

  function onDelete() {
    confirm(t('sermon.deleteTitle'), t('sermon.deleteMessage', { title: item.title }), t('common.delete'), async () => {
      try {
        await remove.mutateAsync(item.id);
        router.back();
      } catch (e) {
        setError(friendlyError(e));
      }
    });
  }

  async function onReview(approve: boolean) {
    setError(null);
    try {
      await review.mutateAsync({ id: item.id, approve, note: note.trim() || undefined });
      router.back();
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  const who = item.author_name || t('polls.aMember');
  const byLine =
    item.source === 'member'
      ? t('sermon.byMember', { name: who })
      : item.source === 'external'
        ? item.speaker
          ? t('sermon.sharedByWith', { name: who, speaker: item.speaker })
          : t('sermons.sharedBy', { name: who })
        : item.speaker;

  return (
    <Screen edges={['bottom']}>
      <SourceTag source={item.source} />
      <Title>{item.title}</Title>
      <ErrorText>{error}</ErrorText>

      {item.status === 'pending' ? (
        <Card>
          <Body>
            {isPastor ? t('sermon.pendingPastor') : t('sermon.pendingMember')}
          </Body>
        </Card>
      ) : null}
      {item.status === 'declined' ? (
        <Card>
          <Heading>{t('sermons.statusDeclined')}</Heading>
          <Body>{item.review_note || t('sermon.declinedDefault')}</Body>
          {canEditOwn ? <Body muted>{t('sermon.canChange')}</Body> : null}
        </Card>
      ) : null}
      {!item.published && official ? (
        <Card>
          <Body>{t('sermon.draftNote')}</Body>
        </Card>
      ) : null}

      <Card>
        {byLine ? <Heading>{byLine}</Heading> : null}
        <Body muted>{formatDay(item.sermon_date)}</Body>
        {item.reference ? <Body>{item.reference}</Body> : null}
      </Card>

      {item.body ? (
        <Card>
          {item.source === 'external' ? <Body muted>{t('sermon.whyShared')}</Body> : null}
          <Body>{item.body}</Body>
        </Card>
      ) : null}

      {item.read_url ? (
        <>
          <Button title={item.source === 'external' ? t('sermon.openSermon') : t('sermon.readSermon')} onPress={() => open(item.read_url!)} />
          <Body muted>{t('sermon.opens', { site: linkSite(item.read_url) })}</Body>
        </>
      ) : null}
      {item.media_url ? (
        <>
          <Button title={t('sermon.watch')} variant={item.read_url ? 'secondary' : 'primary'} onPress={() => open(item.media_url!)} />
          <Body muted>{t('sermon.opens', { site: linkSite(item.media_url) })}</Body>
        </>
      ) : null}

      {!official && !item.is_mine && !isPastor && item.status === 'approved' ? <ReportButton type="sermon" targetId={item.id} /> : null}

      {isPastor && !official && item.status === 'pending' ? (
        <Card>
          <Heading>{t('sermon.yourDecision')}</Heading>
          <TextField
            label={t('sermon.noteLabel')}
            value={note}
            onChangeText={setNote}
            multiline
            maxLength={500}
            style={{ minHeight: 80, paddingTop: 12, textAlignVertical: 'top' }}
            hint={t('sermon.noteHint')}
          />
          <Button title={t('sermon.approve')} onPress={() => onReview(true)} loading={review.isPending} />
          <Button title={t('members.decline')} variant="secondary" onPress={() => onReview(false)} loading={review.isPending} />
        </Card>
      ) : null}

      {isPastor && official ? (
        <Button title={t('verse.edit')} variant="secondary" onPress={() => router.push({ pathname: '/sermon-edit', params: { id: item.id } })} />
      ) : null}
      {canEditOwn ? (
        <Button
          title={t('verse.edit')}
          variant="secondary"
          onPress={() =>
            router.push({ pathname: item.source === 'member' ? '/sermon-write' : '/sermon-suggest', params: { id: item.id } })
          }
        />
      ) : null}
      {isPastor || canEditOwn ? <Button title={t('common.delete')} variant="danger" onPress={onDelete} loading={remove.isPending} /> : null}
    </Screen>
  );
}
