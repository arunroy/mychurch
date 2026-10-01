import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';

import { SourceTag } from '@/components/sermon-tag';
import { Body, Button, Card, ErrorText, Heading, Loading, Screen, TextField, Title } from '@/components/ui';
import { useActiveChurch, usePermissions } from '@/lib/church';
import { confirm } from '@/lib/confirm';
import { formatDay } from '@/lib/dates';
import { linkSite, useDeleteSermon, useReviewSermon, useSermon } from '@/lib/sermons';
import { friendlyError } from '@/lib/supabase';

// One sermon. A member's article is shown in full; an outside sermon is a link; the Pastor's can be text, links or both.
// The Pastor reviews waiting entries here, approving them or declining with a note.
export default function SermonScreen() {
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
        <Body muted>This sermon is no longer in the list.</Body>
        <Button title="Back to sermons" variant="secondary" onPress={() => router.back()} />
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
      setError('Could not open that link.');
    }
  }

  function onDelete() {
    confirm('Delete this sermon?', `“${item.title}” will be removed from the list for everyone.`, 'Delete', async () => {
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

  const byLine =
    item.source === 'member'
      ? `By ${item.author_name || 'a church member'}`
      : item.source === 'external'
        ? `Shared by ${item.author_name || 'a church member'}${item.speaker ? ` · by ${item.speaker}` : ''}`
        : item.speaker;

  return (
    <Screen edges={['bottom']}>
      <SourceTag source={item.source} />
      <Title>{item.title}</Title>
      <ErrorText>{error}</ErrorText>

      {item.status === 'pending' ? (
        <Card>
          <Body>
            {isPastor
              ? 'This is waiting for your review. Until you approve it, only you and its author can see it.'
              : 'This is waiting for the Pastor to review it. Until it is approved, only you and the Pastor can see it.'}
          </Body>
        </Card>
      ) : null}
      {item.status === 'declined' ? (
        <Card>
          <Heading>Not approved</Heading>
          <Body>{item.review_note || 'The Pastor decided not to publish this.'}</Body>
          {canEditOwn ? <Body muted>You can change it and send it back for another review.</Body> : null}
        </Card>
      ) : null}
      {!item.published && official ? (
        <Card>
          <Body>This is a draft. Only you can see it until it is published.</Body>
        </Card>
      ) : null}

      <Card>
        {byLine ? <Heading>{byLine}</Heading> : null}
        <Body muted>{formatDay(item.sermon_date)}</Body>
        {item.reference ? <Body>{item.reference}</Body> : null}
      </Card>

      {item.body ? (
        <Card>
          {item.source === 'external' ? <Body muted>Why it was shared</Body> : null}
          <Body>{item.body}</Body>
        </Card>
      ) : null}

      {item.read_url ? (
        <>
          <Button title={item.source === 'external' ? 'Open the sermon' : 'Read the sermon'} onPress={() => open(item.read_url!)} />
          <Body muted>{`Opens ${linkSite(item.read_url)}`}</Body>
        </>
      ) : null}
      {item.media_url ? (
        <>
          <Button title="Watch or listen" variant={item.read_url ? 'secondary' : 'primary'} onPress={() => open(item.media_url!)} />
          <Body muted>{`Opens ${linkSite(item.media_url)}`}</Body>
        </>
      ) : null}

      {isPastor && !official && item.status === 'pending' ? (
        <Card>
          <Heading>Your decision</Heading>
          <TextField
            label="A note for the author (optional)"
            value={note}
            onChangeText={setNote}
            multiline
            maxLength={500}
            style={{ minHeight: 80, paddingTop: 12, textAlignVertical: 'top' }}
            hint="The author sees this if you decline."
          />
          <Button title="Approve and publish" onPress={() => onReview(true)} loading={review.isPending} />
          <Button title="Decline" variant="secondary" onPress={() => onReview(false)} loading={review.isPending} />
        </Card>
      ) : null}

      {isPastor && official ? (
        <Button title="Edit" variant="secondary" onPress={() => router.push({ pathname: '/sermon-edit', params: { id: item.id } })} />
      ) : null}
      {canEditOwn ? (
        <Button
          title="Edit"
          variant="secondary"
          onPress={() =>
            router.push({ pathname: item.source === 'member' ? '/sermon-write' : '/sermon-suggest', params: { id: item.id } })
          }
        />
      ) : null}
      {isPastor || canEditOwn ? <Button title="Delete" variant="danger" onPress={onDelete} loading={remove.isPending} /> : null}
    </Screen>
  );
}
